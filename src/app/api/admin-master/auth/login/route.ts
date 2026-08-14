import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { anexarCookieMasterSessao } from "@/lib/master-auth";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";
import { executarSemRls } from "@/lib/prisma-tenant";
import {
  extrairIpLogin,
  limparFalhasLogin,
  mensagemBloqueioLogin,
  registrarFalhaLogin,
  statusBloqueioLogin,
  RateLimitIndisponivelError,
  respostaRateLimitIndisponivel,
} from "@/lib/login-rate-limit";
import {
  criarTokenMfaPending,
  mfaPodePularSetup,
  roleExigeMfa,
} from "@/lib/mfa-totp";
import { rejeitarSeOrigemInvalida } from "@/lib/csrf-origin";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

function respostaBloqueioLogin(minutosRestantes: number) {
  const res = NextResponse.json(
    {
      error: mensagemBloqueioLogin(minutosRestantes),
      code: "LOGIN_BLOQUEADO",
      minutosRestantes,
    },
    { status: 429 }
  );
  res.headers.set("Retry-After", String(Math.max(60, minutosRestantes * 60)));
  return res;
}

export async function POST(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  try {
    const body = schema.parse(await request.json());
    const email = body.email.trim().toLowerCase();
    const ip = extrairIpLogin(request);

    const bloqueio = await statusBloqueioLogin(ip, email);
    if (bloqueio.bloqueado) {
      return respostaBloqueioLogin(bloqueio.minutosRestantes);
    }

    const master = await executarSemRls((tx) =>
      tx.masterUser.findUnique({ where: { email } })
    );
    if (!master || !master.ativo || master.role !== "MASTER_ADMIN") {
      const aposFalha = await registrarFalhaLogin(ip, email);
      if (aposFalha.bloqueado) {
        return respostaBloqueioLogin(aposFalha.minutosRestantes);
      }
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const senhaOk = await verifyPassword(body.password, master.senhaHash);
    if (!senhaOk) {
      const aposFalha = await registrarFalhaLogin(ip, email);
      if (aposFalha.bloqueado) {
        return respostaBloqueioLogin(aposFalha.minutosRestantes);
      }
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    await limparFalhasLogin(ip, email);

    if (roleExigeMfa(master.role, "master")) {
      if (master.mfaEnabled) {
        const mfaToken = await criarTokenMfaPending({
          kind: "master",
          purpose: "verify",
          userId: master.id,
          email: master.email,
          remember: body.remember === true,
        });
        return NextResponse.json({
          code: "MFA_REQUIRED",
          mfaToken,
          id: master.id,
          name: master.nome,
          email: master.email,
          role: master.role,
        });
      }

      const mfaToken = await criarTokenMfaPending({
        kind: "master",
        purpose: "setup",
        userId: master.id,
        email: master.email,
        remember: body.remember === true,
      });
      return NextResponse.json({
        code: "MFA_SETUP_REQUIRED",
        mfaToken,
        canSkip: mfaPodePularSetup(),
        id: master.id,
        name: master.nome,
        email: master.email,
        role: master.role,
      });
    }

    await registrarLogMaster(master.id, "LOGIN_MASTER", {
      detalhes: `Login: ${master.email}`,
      ip: ipDaRequisicao(request),
    });

    const resposta = NextResponse.json({
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
      { remember: body.remember === true }
    );
  } catch (error) {
    if (error instanceof RateLimitIndisponivelError) {
      return respostaRateLimitIndisponivel();
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[admin-master/auth/login]", error);
    return NextResponse.json({ error: "Erro ao autenticar." }, { status: 500 });
  }
}
