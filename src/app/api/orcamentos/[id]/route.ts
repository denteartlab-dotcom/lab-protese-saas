import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { acaoHttpParaPermissao, negarSeSemPermissao } from "@/lib/require-permissao";
import { prisma } from "@/lib/db";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";
import {
  calcularTotaisItens,
  totalLiquidoOrcamento,
  type ItemOrcamento,
  type StatusOrcamento,
} from "@/lib/orcamentos-types";
import { mapOrcamento, statusInvalidaLink } from "@/lib/orcamentos-db";
import {
  condicoesPagamentoFromBody,
  registrarDespesaOrcamentoAprovado,
} from "@/lib/orcamentos-financeiro";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const negado = await negarSeSemPermissao(ctx, "orcamentos", acaoHttpParaPermissao("PATCH"));
  if (negado) return negado;

  const { id } = await params;
  const body = (await request.json()) as {
    status?: StatusOrcamento;
    desconto?: number;
    descontoPercentual?: number;
    frete?: number;
    observacoes?: string;
    dataResposta?: string | null;
    itens?: ItemOrcamento[];
    fornecedorId?: string;
    fornecedorNome?: string;
    emailEnvio?: string;
    whatsappEnvio?: string;
    forcarFinanceiro?: boolean;
    reabrirParaEdicao?: boolean;
    condicoesPagamento?: string;
    condicoesPagamentoLista?: unknown;
  };

  const atual = await prisma.orcamento.findFirst({
    where: { id, empresaId: ctx.empresaId },
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

  /** Editar lista + reenviar: volta a aguardar e zera preços para nova cotação. */
  const reabrindoComItens =
    Boolean(body.itens) &&
    (Boolean(body.reabrirParaEdicao) ||
      (statusAnterior === "enviado" && status === "aguardando_resposta"));

  if (
    (body.reabrirParaEdicao || reabrindoComItens) &&
    statusAnterior === "enviado"
  ) {
    status = "aguardando_resposta";
  }

  let itens: ItemOrcamento[] = body.itens ?? JSON.parse(atual.itensJson || "[]");
  if (body.itens && status === "aguardando_resposta") {
    itens = body.itens.map((item) => ({
      ...item,
      valorUnitario: 0,
      emFalta: false,
    }));
  }

  const resetarRespostaFornecedor =
    Boolean(body.reabrirParaEdicao) || reabrindoComItens;

  const subtotal =
    body.itens != null
      ? calcularTotaisItens(itens)
      : resetarRespostaFornecedor
        ? atual.subtotal
        : calcularTotaisItens(itens);
  const desconto =
    body.itens != null && resetarRespostaFornecedor
      ? body.desconto ?? 0
      : body.desconto ?? atual.desconto;
  const descontoPercentual =
    body.itens != null && resetarRespostaFornecedor
      ? body.descontoPercentual ?? 0
      : body.descontoPercentual ?? atual.descontoPercentual;
  const frete =
    body.itens != null && resetarRespostaFornecedor
      ? body.frete !== undefined
        ? Math.max(Number(body.frete) || 0, 0)
        : 0
      : body.frete !== undefined
        ? Math.max(Number(body.frete) || 0, 0)
        : Number((atual as { frete?: number | null }).frete) || 0;
  const totalLiquido =
    body.itens != null
      ? totalLiquidoOrcamento(subtotal, desconto, descontoPercentual, frete)
      : resetarRespostaFornecedor
        ? atual.totalLiquido
        : totalLiquidoOrcamento(subtotal, desconto, descontoPercentual, frete);
  const linkAtivo =
    body.reabrirParaEdicao || reabrindoComItens
      ? true
      : statusInvalidaLink(status)
        ? false
        : atual.linkAtivo;

  const condicoesPagamentoAtualizadas =
    body.condicoesPagamentoLista != null ||
    (typeof body.condicoesPagamento === "string" &&
      body.condicoesPagamento.length > 0)
      ? condicoesPagamentoFromBody({
          condicoesPagamento: body.condicoesPagamento,
          condicoesPagamentoLista: body.condicoesPagamentoLista as never,
        }) || atual.condicoesPagamento
      : atual.condicoesPagamento;

  const row = await prisma.orcamento.update({
    where: { id },
    data: {
      status,
      subtotal,
      desconto,
      descontoPercentual,
      frete,
      totalLiquido,
      observacoes: body.observacoes ?? atual.observacoes,
      condicoesPagamento:
        body.itens != null && resetarRespostaFornecedor
          ? null
          : body.reabrirParaEdicao
            ? atual.condicoesPagamento
            : condicoesPagamentoAtualizadas,
      respostaFornecedor:
        body.itens != null && resetarRespostaFornecedor
          ? null
          : atual.respostaFornecedor,
      fornecedorId: body.fornecedorId ?? atual.fornecedorId,
      fornecedorNome: body.fornecedorNome ?? atual.fornecedorNome,
      emailEnvio: body.emailEnvio ?? atual.emailEnvio,
      whatsappEnvio: body.whatsappEnvio ?? atual.whatsappEnvio,
      dataResposta: resetarRespostaFornecedor
        ? null
        : body.dataResposta
          ? new Date(body.dataResposta)
          : atual.dataResposta,
      itensJson: body.itens ? JSON.stringify(itens) : atual.itensJson,
      linkAtivo,
      updatedAt: new Date(),
    } as Parameters<typeof prisma.orcamento.update>[0]["data"],
  });

  let parcelasFinanceiro = 0;
  if (
    status === "aprovado" &&
    (statusAnterior !== "aprovado" || body.forcarFinanceiro === true)
  ) {
    try {
      const criados = await registrarDespesaOrcamentoAprovado(ctx.empresaId, {
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

  /** Estoque + custos em background (issue 029) — não trava o modal. */
  let estoqueJobId: string | null = null;
  if (status === "aprovado" && statusAnterior !== "aprovado") {
    const job = await criarJob(ctx.empresaId, "aplicar_orcamento", {
      orcamentoId: row.id,
    });
    executarJobEmBackground(job.id, ctx.empresaId);
    estoqueJobId = job.id;
  }

  return NextResponse.json({
    ...mapOrcamento(row),
    parcelasFinanceiro,
    estoqueJobId,
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const negado = await negarSeSemPermissao(ctx, "orcamentos", acaoHttpParaPermissao("DELETE"));
  if (negado) return negado;

  const { id } = await params;
  const atual = await prisma.orcamento.findFirst({
    where: { id, empresaId: ctx.empresaId },
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
