import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import { listarBoletosAsaasEmpresa } from "@/lib/asaas-boletos-servidor";

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(
    ctx,
    "financeiro-aba-conta-bancaria",
    "ver"
  );
  if (negado) return negado;

  const { searchParams } = new URL(request.url);
  try {
    const boletos = await listarBoletosAsaasEmpresa(ctx.empresaId, {
      status: searchParams.get("status") || undefined,
      busca: searchParams.get("busca") || undefined,
      vencimentoDe: searchParams.get("vencimentoDe") || undefined,
      vencimentoAte: searchParams.get("vencimentoAte") || undefined,
      limit: Number(searchParams.get("limit") || "80") || 80,
    });
    return NextResponse.json({ boletos });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar boletos." },
      { status: 422 }
    );
  }
}
