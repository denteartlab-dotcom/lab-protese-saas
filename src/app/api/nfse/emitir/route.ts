import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import { emitirNfseParaCliente } from "@/lib/nfse/servico";
import { z } from "zod";

const schema = z.object({
  clienteId: z.string().min(1),
  valor: z.number().positive(),
  descricao: z.string().optional(),
  lancamentoId: z.string().optional(),
});

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(ctx, "configuracoes-nfse", "criar");
  if (negado) return negado;

  try {
    const body = schema.parse(await request.json());
    const nota = await emitirNfseParaCliente({
      ...body,
      empresaId: ctx.empresaId,
    });
    return NextResponse.json(nota, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Falha ao emitir NFS-e.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
