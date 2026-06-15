import { NextResponse } from "next/server";
import { requireEmpresaContext, verificarTrabalhoEmpresa } from "@/lib/empresa-context";
import {
  registrarMudancaIndiceEtapa,
  registrarRepeticaoManualOs,
  registrarTransicaoEtapa,
} from "@/lib/historico-etapas";
import type { TipoRepeticaoOs } from "@/lib/tipo-repeticao-os";

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
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
      tipoRepeticao?: Exclude<TipoRepeticaoOs, "">;
      indiceEtapaAtual?: number;
      valorProdutos?: number;
      valorServico?: number;
      descricaoProdutos?: string;
      descricaoServico?: string;
    };

    if (!body.trabalhoId) {
      return NextResponse.json({ error: "trabalhoId obrigatório." }, { status: 400 });
    }

    const trabalhoEmpresa = await verificarTrabalhoEmpresa(body.trabalhoId, ctx.empresaId);
    if (!trabalhoEmpresa) {
      return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    }

    if (body.tipoRepeticao) {
      const registro = await registrarRepeticaoManualOs({
        trabalhoId: body.trabalhoId,
        itemId: body.itemId,
        tipoRepeticao: body.tipoRepeticao,
        indiceEtapaAtual: body.indiceEtapaAtual ?? 0,
        valorProdutos: body.valorProdutos,
        valorServico: body.valorServico,
        descricaoProdutos: body.descricaoProdutos,
        descricaoServico: body.descricaoServico,
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
      empresaId: ctx.empresaId,
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
