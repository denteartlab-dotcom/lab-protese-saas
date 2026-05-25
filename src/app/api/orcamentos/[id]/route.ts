import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  calcularTotaisItens,
  totalLiquidoOrcamento,
  type ItemOrcamento,
  type StatusOrcamento,
} from "@/lib/orcamentos-types";
import { mapOrcamento, statusInvalidaLink } from "@/lib/orcamentos-db";
import { registrarDespesaOrcamentoAprovado } from "@/lib/orcamentos-financeiro";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as {
    status?: StatusOrcamento;
    desconto?: number;
    descontoPercentual?: number;
    observacoes?: string;
    dataResposta?: string | null;
    itens?: ItemOrcamento[];
    fornecedorId?: string;
    fornecedorNome?: string;
    emailEnvio?: string;
    whatsappEnvio?: string;
    forcarFinanceiro?: boolean;
    reabrirParaEdicao?: boolean;
  };

  const atual = await prisma.orcamento.findFirst({
    where: { id },
  });
  if (!atual) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const statusAnterior = atual.status as StatusOrcamento;

  if (body.reabrirParaEdicao) {
    if (statusAnterior !== "enviado") {
      return NextResponse.json(
        {
          error: "reabrir_invalido",
          message:
            "Só é possível reabrir o link de orçamentos já enviados pelo fornecedor.",
        },
        { status: 400 }
      );
    }
  }

  let status = body.status ?? statusAnterior;
  if (body.reabrirParaEdicao) {
    status = "aguardando_resposta";
  }

  let itens: ItemOrcamento[] = body.itens ?? JSON.parse(atual.itensJson || "[]");
  if (body.itens && status === "aguardando_resposta" && !body.reabrirParaEdicao) {
    itens = body.itens.map((item) => ({ ...item, valorUnitario: 0 }));
  }
  const subtotal = body.reabrirParaEdicao
    ? atual.subtotal
    : calcularTotaisItens(itens);
  const desconto = body.desconto ?? atual.desconto;
  const descontoPercentual = body.descontoPercentual ?? atual.descontoPercentual;
  const totalLiquido = body.reabrirParaEdicao
    ? atual.totalLiquido
    : totalLiquidoOrcamento(subtotal, desconto, descontoPercentual);
  const linkAtivo = body.reabrirParaEdicao
    ? true
    : statusInvalidaLink(status)
      ? false
      : atual.linkAtivo;

  const row = await prisma.orcamento.update({
    where: { id },
    data: {
      status,
      subtotal,
      desconto,
      descontoPercentual,
      totalLiquido,
      observacoes: body.observacoes ?? atual.observacoes,
      fornecedorId: body.fornecedorId ?? atual.fornecedorId,
      fornecedorNome: body.fornecedorNome ?? atual.fornecedorNome,
      emailEnvio: body.emailEnvio ?? atual.emailEnvio,
      whatsappEnvio: body.whatsappEnvio ?? atual.whatsappEnvio,
      dataResposta: body.reabrirParaEdicao
        ? null
        : body.dataResposta
          ? new Date(body.dataResposta)
          : atual.dataResposta,
      itensJson: body.itens ? JSON.stringify(itens) : atual.itensJson,
      linkAtivo,
      updatedAt: new Date(),
    },
  });

  let parcelasFinanceiro = 0;
  if (
    status === "aprovado" &&
    (statusAnterior !== "aprovado" || body.forcarFinanceiro === true)
  ) {
    try {
      const criados = await registrarDespesaOrcamentoAprovado({
        numeroPedido: row.numeroPedido,
        fornecedorNome: row.fornecedorNome,
        totalLiquido: row.totalLiquido,
        dataAprovacao: new Date(),
        condicoesPagamento: row.condicoesPagamento,
      });
      parcelasFinanceiro = Array.isArray(criados) ? criados.length : 0;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível registrar as despesas em Contas a Pagar.";
      console.error("[orcamento aprovar financeiro]", err);
      return NextResponse.json(
        { error: "financeiro_falhou", message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ...mapOrcamento(row),
    parcelasFinanceiro,
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const atual = await prisma.orcamento.findFirst({
    where: { id },
  });
  if (!atual) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const row = await prisma.orcamento.update({
    where: { id },
    data: {
      status: "excluido",
      linkAtivo: false,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json(mapOrcamento(row));
}
