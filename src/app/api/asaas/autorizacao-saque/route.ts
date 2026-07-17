import { NextResponse } from "next/server";
import { validarWebhookTokenAsaas } from "@/lib/asaas-client";
import { contaMaeAsaasConfigurada } from "@/lib/asaas-conta-mae-config";
import { APP_URL } from "@/lib/app-url";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  avaliarAutorizacaoSaqueAsaas,
  limparAutorizacoesPixExpiradas,
} from "@/lib/seguranca-pix-subconta";

const ROTA = "/api/asaas/autorizacao-saque";

/** Health público mínimo; detalhes só com sessão autenticada. */
export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({
      ok: true,
      provedor: "asaas",
      metodoAsaas: "POST",
    });
  }

  return NextResponse.json({
    ok: true,
    provedor: "asaas",
    autorizacaoSaqueUrl: `${APP_URL}${ROTA}`,
    metodoAsaas: "POST",
    contaMaeConfigurada: contaMaeAsaasConfigurada(),
    instrucoes:
      "Cadastre esta URL como webhook de autorização de saque no painel Asaas (conta-mãe). O header asaas-access-token deve coincidir com ASAAS_CONTA_MAE_WEBHOOK_TOKEN.",
  });
}

export async function POST(request: Request) {
  const tokenRecebido =
    request.headers.get("asaas-access-token") ||
    request.headers.get("x-asaas-access-token") ||
    "";

  if (!(await validarWebhookTokenAsaas(tokenRecebido))) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Parameters<typeof avaliarAutorizacaoSaqueAsaas>[0];
    void limparAutorizacoesPixExpiradas();
    const resultado = await avaliarAutorizacaoSaqueAsaas(body);
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[asaas/autorizacao-saque]", error);
    return NextResponse.json({
      status: "REFUSED",
      refuseReason: "Falha ao validar a transferência.",
    });
  }
}
