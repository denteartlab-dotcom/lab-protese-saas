/**
 * MFA opcional nas configurações do usuário (sessão autenticada).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { getSession, verifyPassword } from "@/lib/auth";
import { executarSemRls } from "@/lib/prisma-tenant";
import { rejeitarSeOrigemInvalida } from "@/lib/csrf-origin";
import {
  criarTokenMfaPending,
  criptografarSegredoMfa,
  descriptografarSegredoMfa,
  gerarSegredoTotp,
  lerTokenMfaPending,
  uriOtpauth,
  validarCodigoTotp,
} from "@/lib/mfa-totp";

export async function mfaStatusGet() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const row = await executarSemRls((tx) =>
    tx.user.findUnique({
      where: { id: session.id },
      select: { mfaEnabled: true, mfaEnabledAt: true },
    })
  );

  return NextResponse.json({
    mfaEnabled: row?.mfaEnabled === true,
    mfaEnabledAt: row?.mfaEnabledAt?.toISOString() ?? null,
  });
}

export async function mfaEnableStartPost(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const user = await executarSemRls((tx) =>
    tx.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, mfaEnabled: true, excluidoEm: true },
    })
  );
  if (!user || user.excluidoEm) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }
  if (user.mfaEnabled) {
    return NextResponse.json(
      { error: "A autenticação em dois fatores já está ativa." },
      { status: 400 }
    );
  }

  const secret = gerarSegredoTotp();
  const otpauthUri = uriOtpauth({
    secret,
    email: user.email,
    issuer: "Lab Protese",
  });
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 });
  const mfaToken = await criarTokenMfaPending({
    kind: "lab",
    purpose: "setup",
    userId: user.id,
    email: user.email,
    secret,
  });

  return NextResponse.json({
    ok: true,
    mfaToken,
    otpauthUri,
    qrDataUrl,
    secret,
  });
}

const confirmSchema = z.object({
  mfaToken: z.string().min(20),
  codigo: z.string().min(6).max(8),
});

export async function mfaEnableConfirmPost(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = confirmSchema.parse(await request.json());
    const pending = await lerTokenMfaPending(body.mfaToken);
    if (
      !pending ||
      pending.purpose !== "setup" ||
      pending.kind !== "lab" ||
      pending.userId !== session.id ||
      !pending.secret
    ) {
      return NextResponse.json(
        { error: "Reinicie a configuração do autenticador." },
        { status: 401 }
      );
    }

    if (!validarCodigoTotp(pending.secret, body.codigo)) {
      return NextResponse.json({ error: "Código inválido." }, { status: 400 });
    }

    const enc = criptografarSegredoMfa(pending.secret);
    await executarSemRls((tx) =>
      tx.user.update({
        where: { id: session.id },
        data: {
          mfaSecretEnc: enc,
          mfaEnabled: true,
          mfaEnabledAt: new Date(),
        },
      })
    );

    return NextResponse.json({
      ok: true,
      message: "Autenticação em dois fatores ativada.",
      mfaEnabled: true,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[mfa/enable/confirm]", err);
    return NextResponse.json({ error: "Erro ao ativar MFA." }, { status: 500 });
  }
}

const disableSchema = z.object({
  senha: z.string().min(1, "Informe a senha."),
  codigo: z.string().min(6).max(8).optional(),
});

export async function mfaDisablePost(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = disableSchema.parse(await request.json());
    const user = await executarSemRls((tx) =>
      tx.user.findUnique({
        where: { id: session.id },
        select: {
          id: true,
          password: true,
          mfaEnabled: true,
          mfaSecretEnc: true,
        },
      })
    );
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }
    if (!user.mfaEnabled) {
      return NextResponse.json({
        ok: true,
        message: "MFA já estava desativado.",
        mfaEnabled: false,
      });
    }

    const senhaOk = await verifyPassword(body.senha, user.password);
    if (!senhaOk) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 400 });
    }

    if (user.mfaSecretEnc) {
      if (!body.codigo?.trim()) {
        return NextResponse.json(
          { error: "Informe o código do autenticador para desativar." },
          { status: 400 }
        );
      }
      let secret: string;
      try {
        secret = descriptografarSegredoMfa(user.mfaSecretEnc);
      } catch {
        return NextResponse.json({ error: "Configuração MFA inválida." }, { status: 500 });
      }
      if (!validarCodigoTotp(secret, body.codigo)) {
        return NextResponse.json({ error: "Código inválido." }, { status: 400 });
      }
    }

    await executarSemRls((tx) =>
      tx.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: false,
          mfaSecretEnc: null,
          mfaEnabledAt: null,
          mfaBackupCodesHash: null,
        },
      })
    );

    return NextResponse.json({
      ok: true,
      message: "Autenticação em dois fatores desativada.",
      mfaEnabled: false,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }
    console.error("[mfa/disable]", err);
    return NextResponse.json({ error: "Erro ao desativar MFA." }, { status: 500 });
  }
}
