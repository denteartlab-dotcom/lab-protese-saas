import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { carregarContatosOrigem } from "@/lib/whatsapp-disparos/campanha-servidor";

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const origem = new URL(request.url).searchParams.get("origem");
  if (origem !== "pacientes" && origem !== "clientes") {
    return NextResponse.json({ error: "Origem inválida" }, { status: 400 });
  }

  const resumo = await carregarContatosOrigem(ctx.empresaId, origem);
  return NextResponse.json(resumo);
}
