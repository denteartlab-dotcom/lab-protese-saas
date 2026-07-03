import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  montarNotificacoesEmpresa,
  type NotificacaoApi,
} from "@/lib/notificacoes-resumo-server";

export type { NotificacaoApi };

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const dados = await montarNotificacoesEmpresa(ctx.empresaId);
  return NextResponse.json(dados);
}
