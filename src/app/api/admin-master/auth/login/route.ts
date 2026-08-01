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
} from "@/lib/login-rate-limit";
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
  try {
    const body = schema.parse(await request.json());
    const email = body.email.trim().toLowerCase();
    const ip = extrairIpLogin(request);

    const bloqueio = await statusBloqueioLogin(ip, email);
    if (bloqueio.bloqueado) {
      return respostaBloqueioLogin(bloqueio.minutosRestantes);
    }

    // executarSemRls: set_config na MESMA transação — o runWithRlsBypass
    // sozinho depende do AsyncLocalStorage atravessar o bundle, o que já
    // falhou em produção (master_users tem policy bypass-only).
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
    return anexarCookieMasterSessao(resposta, {
      id: master.id,
      name: master.nome,
      email: master.email,
      role: master.role,
    }, { remember: body.remember === true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[admin-master/auth/login]", error);
    return NextResponse.json({ error: "Erro ao autenticar." }, { status: 500 });
  }
}
