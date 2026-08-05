import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { gerarMensagemAniversario } from "@/lib/mensagem-aniversario";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  clienteId: z.string().min(1).optional(),
  nomeCliente: z.string().min(1).optional(),
  /** Enviado a cada clique para garantir mensagem diferente. */
  semente: z.string().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = schema.parse(await request.json());
    let nomeCliente = (body.nomeCliente || "").trim();

    if (body.clienteId) {
      const cliente = await prisma.cliente.findFirst({
        where: { id: body.clienteId, empresaId: ctx.empresaId },
        select: { nome: true },
      });
      if (!cliente) {
        return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
      }
      nomeCliente = cliente.nome;
    }

    if (!nomeCliente) {
      return NextResponse.json({ error: "Informe o cliente." }, { status: 400 });
    }

    const resultado = await gerarMensagemAniversario({
      nomeCliente,
      nomeLaboratorio: ctx.empresaNome,
      semente: body.semente,
    });

    return NextResponse.json(resultado, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[aniversariantes/mensagem]", error);
    return NextResponse.json({ error: "Erro ao gerar mensagem." }, { status: 500 });
  }
}
