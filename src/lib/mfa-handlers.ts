import { NextResponse } from "next/server";
import { z } from "zod";
import { anexarCookieSessao } from "@/lib/auth";
import { anexarCookieMasterSessao } from "@/lib/master-auth";
import { executarSemRls } from "@/lib/prisma-tenant";
import { montarSessionUserComAssinatura } from "@/lib/sessao-assinatura";
import { registrarUltimoAcessoEmpresaImediato } from "@/lib/empresa-ultimo-acesso";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";
import {
  criarTokenMfaPending,
  criptografarSegredoMfa,
  gerarSegredoTotp,
  lerTokenMfaPending,
  uriOtpauth,
  validarCodigoTotp,
} from "@/lib/mfa-totp";
import {
  extrairIpLogin,
  registrarAcaoEmail,
  acaoEmailBloqueada,
  RateLimitIndisponivelError,
  respostaRateLimitIndisponivel,
} from "@/lib/login-rate-limit";
import { rejeitarSeOrigemInvalida } from "@/lib/csrf-origin";
import QRCode from "qrcode";

const tokenSchema = z.object({
  mfaToken: z.string().min(20),
});

const confirmSchema = z.object({
  mfaToken: z.string().min(20),
  codigo: z.string().min(6).max(8),
});

async function emitirSessaoLab(
  request: Request,
  userId: string,
  remember: boolean
) {
  const sessionUser = await montarSessionUserComAssinatura(userId);
  if (!sessionUser?.empresaId) {
    return NextResponse.json({ error: "Usuário indisponível." }, { status: 403 });
  }
  await registrarUltimoAcessoEmpresaImediato(sessionUser.empresaId);
  const resposta = NextResponse.json({
    ok: true,
    user: {
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      empresaSlug: sessionUser.empresaSlug,
      empresaNome: sessionUser.empresaNome,
    },
    ...(sessionUser.assinaturaVencida
      ? { code: "ASSINATURA_VENCIDA", redirect: "/assinatura-vencida" }
      : {}),
  });
  return anexarCookieSessao(resposta, sessionUser, { remember, request });
}

async function emitirSessaoMaster(
  request: Request,
  masterId: string,
  remember: boolean
) {
  const master = await executarSemRls((tx) =>
    tx.masterUser.findUnique({
      where: { id: masterId },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
        sessionVersion: true,
      },
    })
  );
  if (!master || !master.ativo) {
    return NextResponse.json({ error: "Conta master indisponível." }, { status: 403 });
  }
  await registrarLogMaster(master.id, "LOGIN_MASTER", {
    detalhes: `Login MFA: ${master.email}`,
    ip: ipDaRequisicao(request),
  });
  const resposta = NextResponse.json({
    ok: true,
    id: master.id,
    name: master.nome,
    email: master.email,
    role: master.role,
  });
  return anexarCookieMasterSessao(
    resposta,
    {
      id: master.id,
      name: master.nome,
      email: master.email,
      role: master.role,
      sessionVersion: master.sessionVersion ?? 0,
    },
    { remember }
  );
}

/** Inicia setup: gera secret + QR. */
export async function POST_SETUP_START(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  try {
    const body = tokenSchema.parse(await request.json());
    const pending = await lerTokenMfaPending(body.mfaToken);
    if (!pending || pending.purpose !== "setup") {
      return NextResponse.json({ error: "Token MFA inválido ou expirado." }, { status: 401 });
    }

    const secret = gerarSegredoTotp();
    const issuer = pending.kind === "master" ? "Lab Protese Master" : "Lab Protese";
    const otpauthUri = uriOtpauth({
      secret,
      email: pending.email,
      issuer,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 });

    const mfaToken = await criarTokenMfaPending({
      ...pending,
      purpose: "setup",
      secret,
    });

    return NextResponse.json({
      ok: true,
      mfaToken,
      otpauthUri,
      qrDataUrl,
      secret,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[mfa/setup/start]", err);
    return NextResponse.json({ error: "Erro ao iniciar MFA." }, { status: 500 });
  }
}

/** Confirma setup com código TOTP e emite sessão. */
export async function POST_SETUP_CONFIRM(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  try {
    const body = confirmSchema.parse(await request.json());
    const pending = await lerTokenMfaPending(body.mfaToken);
    if (!pending || pending.purpose !== "setup" || !pending.secret) {
      return NextResponse.json(
        { error: "Reinicie a configuração do autenticador." },
        { status: 401 }
      );
    }

    const ip = extrairIpLogin(request);
    if (await acaoEmailBloqueada("mfa-verify", ip, pending.email)) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos." },
        { status: 429 }
      );
    }

    if (!validarCodigoTotp(pending.secret, body.codigo)) {
      await registrarAcaoEmail("mfa-verify", ip, pending.email);
      return NextResponse.json({ error: "Código inválido." }, { status: 400 });
    }

    const enc = criptografarSegredoMfa(pending.secret);
    if (pending.kind === "master") {
      await executarSemRls((tx) =>
        tx.masterUser.update({
          where: { id: pending.userId },
          data: {
            mfaSecretEnc: enc,
            mfaEnabled: true,
            mfaEnabledAt: new Date(),
          },
        })
      );
      return emitirSessaoMaster(request, pending.userId, pending.remember === true);
    }

    await executarSemRls((tx) =>
      tx.user.update({
        where: { id: pending.userId },
        data: {
          mfaSecretEnc: enc,
          mfaEnabled: true,
          mfaEnabledAt: new Date(),
        },
      })
    );
    return emitirSessaoLab(request, pending.userId, pending.remember === true);
  } catch (err) {
    if (err instanceof RateLimitIndisponivelError) {
      return respostaRateLimitIndisponivel();
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[mfa/setup/confirm]", err);
    return NextResponse.json({ error: "Erro ao confirmar MFA." }, { status: 500 });
  }
}

/** Verifica TOTP no login e emite sessão. */
export async function POST_VERIFY(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  try {
    const body = confirmSchema.parse(await request.json());
    const pending = await lerTokenMfaPending(body.mfaToken);
    if (!pending || pending.purpose !== "verify") {
      return NextResponse.json({ error: "Token MFA inválido ou expirado." }, { status: 401 });
    }

    const ip = extrairIpLogin(request);
    if (await acaoEmailBloqueada("mfa-verify", ip, pending.email)) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos." },
        { status: 429 }
      );
    }

    const row =
      pending.kind === "master"
        ? await executarSemRls((tx) =>
            tx.masterUser.findUnique({
              where: { id: pending.userId },
              select: { mfaSecretEnc: true, mfaEnabled: true, ativo: true },
            })
          )
        : await executarSemRls((tx) =>
            tx.user.findUnique({
              where: { id: pending.userId },
              select: { mfaSecretEnc: true, mfaEnabled: true, excluidoEm: true },
            })
          );

    if (!row || !("mfaEnabled" in row) || !row.mfaEnabled || !row.mfaSecretEnc) {
      return NextResponse.json({ error: "MFA não configurado." }, { status: 400 });
    }
    if (pending.kind === "master" && "ativo" in row && !row.ativo) {
      return NextResponse.json({ error: "Conta indisponível." }, { status: 403 });
    }
    if (pending.kind === "lab" && "excluidoEm" in row && row.excluidoEm) {
      return NextResponse.json({ error: "Conta indisponível." }, { status: 403 });
    }

    const { descriptografarSegredoMfa } = await import("@/lib/mfa-totp");
    let secret: string;
    try {
      secret = descriptografarSegredoMfa(row.mfaSecretEnc);
    } catch {
      return NextResponse.json({ error: "Configuração MFA inválida." }, { status: 500 });
    }

    if (!validarCodigoTotp(secret, body.codigo)) {
      await registrarAcaoEmail("mfa-verify", ip, pending.email);
      return NextResponse.json({ error: "Código inválido." }, { status: 400 });
    }

    if (pending.kind === "master") {
      return emitirSessaoMaster(request, pending.userId, pending.remember === true);
    }
    return emitirSessaoLab(request, pending.userId, pending.remember === true);
  } catch (err) {
    if (err instanceof RateLimitIndisponivelError) {
      return respostaRateLimitIndisponivel();
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[mfa/verify]", err);
    return NextResponse.json({ error: "Erro ao verificar MFA." }, { status: 500 });
  }
}

/** Pula setup durante período de graça. */
export async function POST_SKIP(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  try {
    const { mfaPodePularSetup } = await import("@/lib/mfa-totp");
    if (!mfaPodePularSetup()) {
      return NextResponse.json(
        { error: "O período de graça do MFA encerrou. Configure o autenticador." },
        { status: 403 }
      );
    }

    const body = tokenSchema.parse(await request.json());
    const pending = await lerTokenMfaPending(body.mfaToken);
    if (!pending || pending.purpose !== "setup") {
      return NextResponse.json({ error: "Token MFA inválido." }, { status: 401 });
    }

    if (pending.kind === "master") {
      return emitirSessaoMaster(request, pending.userId, pending.remember === true);
    }
    return emitirSessaoLab(request, pending.userId, pending.remember === true);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[mfa/skip]", err);
    return NextResponse.json({ error: "Erro ao pular MFA." }, { status: 500 });
  }
}
