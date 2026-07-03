import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  schemaQueryContextoCadastro,
  tipoContextoCadastroValido,
} from "@/lib/cadastros-contexto-schema";
import { montarContextoCadastro } from "@/lib/cadastros-contexto-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const tipoParam = new URL(request.url).searchParams.get("tipo")?.trim() || "";
  if (!tipoContextoCadastroValido(tipoParam)) {
    return NextResponse.json(
      { error: "Informe tipo=colaborador ou fornecedor." },
      { status: 400 }
    );
  }

  schemaQueryContextoCadastro.parse({ tipo: tipoParam });
  const dados = await montarContextoCadastro(ctx.empresaId, tipoParam);
  return NextResponse.json(dados);
}
