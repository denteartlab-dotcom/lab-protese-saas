import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { anexarCookieMasterSessao } from "@/lib/master-auth";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";
import { executarSemRls } from "@/lib/prisma-tenant";
import {
  extrairIpLogin,
  limparFalhasLogin,
  loginBloqueadoPorRateLimit,
  registrarFalhaLogin,
} from "@/lib/login-rate-limit";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const email = body.email.trim().toLowerCase();
    const ip = extrairIpLogin(request);

    if (loginBloqueadoPorRateLimit(ip, email)) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em alguns minutos." },
        { status: 429 }
      );
    }

    // executarSemRls: set_config na MESMA transação — o runWithRlsBypass
    // sozinho depende do AsyncLocalStorage atravessar o bundle, o que já
    // falhou em produção (master_users tem policy bypass-only).
    const master = await executarSemRls((tx) =>
      tx.masterUser.findUnique({ where: { email } })
    );
    if (!master || !master.ativo || master.role !== "MASTER_ADMIN") {
      registrarFalhaLogin(ip, email);
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const senhaOk = await verifyPassword(body.password, master.senhaHash);
    if (!senhaOk) {
      registrarFalhaLogin(ip, email);
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    limparFalhasLogin(ip, email);

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
