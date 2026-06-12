import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  registrarMudancaIndiceEtapa,
  registrarRepeticaoPorAtualizacaoOs,
  registrarTransicaoEtapa,
} from "@/lib/historico-etapas";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      trabalhoId?: string;
      numeroOs?: number;
      clienteId?: string;
      itemId?: string;
      indiceAnterior?: number;
      indiceNovo?: number;
      etapaAnterior?: string;
      etapaNova?: string;
      colaboradorNome?: string;
      motivoRetorno?: string;
      observacao?: string;
      repeticaoAtualizacao?: boolean;
      indiceAtual?: number;
    };

    if (!body.trabalhoId) {
      return NextResponse.json({ error: "trabalhoId obrigatório." }, { status: 400 });
    }

    if (body.repeticaoAtualizacao && typeof body.indiceAtual === "number") {
      const registro = await registrarRepeticaoPorAtualizacaoOs({
        trabalhoId: body.trabalhoId,
        itemId: body.itemId,
        indiceAtual: body.indiceAtual,
        motivoRetorno: body.motivoRetorno,
        observacao: body.observacao,
      });
      return NextResponse.json({ ok: true, id: registro?.id ?? null });
    }

    if (
      typeof body.indiceAnterior === "number" &&
      typeof body.indiceNovo === "number"
    ) {
      const registro = await registrarMudancaIndiceEtapa({
        trabalhoId: body.trabalhoId,
        itemId: body.itemId,
        indiceAnterior: body.indiceAnterior,
        indiceNovo: body.indiceNovo,
        colaboradorNome: body.colaboradorNome,
        motivoRetorno: body.motivoRetorno,
      });
      return NextResponse.json({ ok: true, id: registro?.id ?? null });
    }

    if (!body.etapaNova || !body.numeroOs || !body.clienteId) {
      return NextResponse.json(
        { error: "etapaNova, numeroOs e clienteId são obrigatórios." },
        { status: 400 }
      );
    }

    const registro = await registrarTransicaoEtapa({
      trabalhoId: body.trabalhoId,
      numeroOs: body.numeroOs,
      clienteId: body.clienteId,
      itemId: body.itemId,
      etapaAnterior: body.etapaAnterior,
      etapaNova: body.etapaNova,
      colaboradorNome: body.colaboradorNome,
      motivoRetorno: body.motivoRetorno,
      observacao: body.observacao,
    });

    return NextResponse.json({ ok: true, id: registro?.id ?? null });
  } catch (error) {
    console.error("[historico-etapas/registrar]", error);
    return NextResponse.json(
      { error: "Não foi possível registrar o histórico de etapa." },
      { status: 500 }
    );
  }
}
