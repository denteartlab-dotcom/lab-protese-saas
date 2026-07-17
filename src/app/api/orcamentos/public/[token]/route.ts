import { NextResponse } from "next/server";
import { buscarOrcamentoPublicoPorToken } from "@/lib/tenant-db";
import { executarSemRls } from "@/lib/db";
import {
  calcularTotaisItens,
  linkOrcamentoAtivo,
  totalLiquidoOrcamento,
  type ItemOrcamento,
  type StatusOrcamento,
} from "@/lib/orcamentos-types";
import { mapOrcamento } from "@/lib/orcamentos-db";
import { condicoesPagamentoFromBody } from "@/lib/orcamentos-financeiro";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const encontrado = await buscarOrcamentoPublicoPorToken(token);

  if (!encontrado) {
    return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
  }

  const orcamento = mapOrcamento(encontrado.orcamento);
  const ativo = linkOrcamentoAtivo(
    orcamento.status,
    orcamento.linkAtivo
  );

  if (!ativo) {
    return NextResponse.json(
      {
        error: "link_expirado",
        message: "Este link de orçamento não está mais disponível.",
        status: orcamento.status,
        numeroPedido: orcamento.numeroPedido,
      },
      { status: 410 }
    );
  }

  return NextResponse.json(orcamento);
}

type BodyFornecedor = {
  itens: ItemOrcamento[];
  desconto?: number;
  descontoPercentual?: number;
  observacoes?: string;
  condicoesPagamento?: string;
  formaPagamento?: string;
  parcelas?: number;
  respostaFornecedor?: string;
};

export async function PATCH(request: Request, { params }: Params) {
  const { token } = await params;
  const encontrado = await buscarOrcamentoPublicoPorToken(token);

  if (!encontrado) {
    return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
  }

  const { orcamento: row } = encontrado;
  const atual = mapOrcamento(row);
  if (!linkOrcamentoAtivo(atual.status, atual.linkAtivo)) {
    return NextResponse.json(
      { error: "link_expirado", message: "Este link não aceita mais respostas." },
      { status: 410 }
    );
  }

  if (atual.status !== "aguardando_resposta") {
    return NextResponse.json(
      {
        error: "ja_respondido",
        message:
          atual.status === "enviado"
            ? "Orçamento já foi enviado pelo fornecedor."
            : "Este pedido não aceita mais respostas.",
      },
      { status: 409 }
    );
  }

  const body = (await request.json()) as BodyFornecedor;
  if (!Array.isArray(body.itens) || body.itens.length === 0) {
    return NextResponse.json({ error: "Itens obrigatórios" }, { status: 400 });
  }

  const subtotal = calcularTotaisItens(body.itens);
  const desconto = body.desconto ?? 0;
  const descontoPercentual = body.descontoPercentual ?? 0;
  const totalLiquido = totalLiquidoOrcamento(
    subtotal,
    desconto,
    descontoPercentual
  );

  const dataResposta = new Date();
  const condicoesPagamento = condicoesPagamentoFromBody(body) || null;

  // Link público autenticado pelo token — bypass no mesmo transaction.
  const updated = await executarSemRls((tx) =>
    tx.orcamento.update({
    where: { token },
    data: {
      itensJson: JSON.stringify(body.itens),
      subtotal,
      desconto,
      descontoPercentual,
      totalLiquido,
      observacoes: body.observacoes ?? atual.observacoes,
      condicoesPagamento,
      respostaFornecedor: body.respostaFornecedor ?? null,
      status: "enviado",
      dataResposta,
      updatedAt: new Date(),
    },
    })
  );

  /** 202 Accepted — confirmação rápida ao fornecedor (issue 029). */
  return NextResponse.json(
    {
      ok: true,
      mensagem: "Resposta recebida com sucesso. O laboratório foi notificado.",
      ...mapOrcamento(updated),
    },
    { status: 202 }
  );
}
