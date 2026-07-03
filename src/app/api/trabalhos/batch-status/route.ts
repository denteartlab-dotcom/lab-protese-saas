import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { aplicarMudancaStatusLote } from "@/lib/trabalho-status-servidor";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  status: z.string().min(1),
});

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ids, status } = schema.parse(body);
    const resultado = await aplicarMudancaStatusLote(ctx.empresaId, ids, status, ctx.user);

    return NextResponse.json({
      ok: true,
      status: resultado.status,
      atualizados: resultado.atualizados.length,
      ignorados: resultado.ignorados,
      trabalhoIds: resultado.atualizados.map((r) => r.id),
      numerosOs: [...new Set(resultado.atualizados.map((r) => r.numeroOs))],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const mensagem = error.issues
        .map((issue) => {
          const campo = issue.path.length ? issue.path.join(".") : "dados";
          return `${campo}: ${issue.message}`;
        })
        .join("; ");
      return NextResponse.json({ error: mensagem || "Dados inválidos" }, { status: 400 });
    }
    console.error("POST /api/trabalhos/batch-status", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar as OS em lote." },
      { status: 500 }
    );
  }
}
