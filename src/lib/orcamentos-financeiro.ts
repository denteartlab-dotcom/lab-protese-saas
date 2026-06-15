import { prisma } from "@/lib/db";
import { desempacotarDespesa, empacotarDespesa } from "@/lib/lancamento-despesa";
import {
  dataVencimentoParcelaOrcamento,
  dividirValorParcelas,
  exigeParcelamento,
  normalizarParcelas,
  parseCondicoesPagamento,
  rotuloCondicoesPagamento,
  serializarCondicoesPagamento,
  type CondicoesPagamentoOrcamento,
  type FormaPagamentoOrcamento,
} from "@/lib/orcamentos-pagamento";

export function descricaoDespesaOrcamento(
  numeroPedido: number,
  fornecedorNome: string,
  parcela?: { atual: number; total: number }
) {
  const base = `Orçamento #${numeroPedido} - ${fornecedorNome || "Fornecedor"}`;
  if (!parcela) return base;
  return `${base} (Parcela ${parcela.atual}/${parcela.total})`;
}

export function despesaPertenceAoOrcamento(
  descricao: string,
  numeroPedido: number
) {
  const marcador = `Orçamento #${numeroPedido}`;
  if (descricao.includes(marcador)) return true;
  const pack = desempacotarDespesa(descricao);
  return pack.referencia === `Pedido ${numeroPedido}`;
}

export async function listarDespesasOrcamento(empresaId: string, numeroPedido: number) {
  const despesas = await prisma.lancamento.findMany({
    where: { empresaId, tipo: "despesa" },
    orderBy: { data: "asc" },
  });
  return despesas.filter((l) => despesaPertenceAoOrcamento(l.descricao, numeroPedido));
}

export async function removerDespesasOrcamento(empresaId: string, numeroPedido: number) {
  const existentes = await listarDespesasOrcamento(empresaId, numeroPedido);
  if (existentes.length === 0) return 0;
  await prisma.lancamento.deleteMany({
    where: { id: { in: existentes.map((l) => l.id) } },
  });
  return existentes.length;
}

async function criarParcelasDespesaOrcamento(
  empresaId: string,
  orcamento: {
    numeroPedido: number;
    fornecedorNome: string;
    totalLiquido: number;
    dataAprovacao: Date;
    parcelas: number;
  }
) {
  const parcelas = normalizarParcelas(orcamento.parcelas);
  const valores = dividirValorParcelas(orcamento.totalLiquido, parcelas);
  const criados = [];

  for (let i = 0; i < parcelas; i++) {
    const numero = i + 1;
    const descricao = empacotarDespesa(
      descricaoDespesaOrcamento(orcamento.numeroPedido, orcamento.fornecedorNome, {
        atual: numero,
        total: parcelas,
      }),
      {
        entidade: "fornecedores",
        parcela: `${numero}/${parcelas}`,
        referencia: `Pedido ${orcamento.numeroPedido}`,
        nome: orcamento.fornecedorNome || "Fornecedor",
        categoria: "Orçamento",
      }
    );

    const lancamento = await prisma.lancamento.create({
      data: {
        empresaId,
        tipo: "despesa",
        descricao,
        valor: valores[i],
        data: dataVencimentoParcelaOrcamento(orcamento.dataAprovacao, numero),
        status: "pendente",
        formaPagamento: "Boleto",
      },
    });
    criados.push(lancamento);
  }

  return criados;
}

/** Registra despesas ao aprovar orçamento (parcelas 30/30/30… ou lançamento único). */
export async function registrarDespesaOrcamentoAprovado(
  empresaId: string,
  orcamento: {
    numeroPedido: number;
    fornecedorNome: string;
    totalLiquido: number;
    dataAprovacao: Date;
    condicoesPagamento: string | null;
  }
) {
  const valor = Number(orcamento.totalLiquido);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(
      `Orçamento #${orcamento.numeroPedido} sem valor líquido para gerar despesa.`
    );
  }

  const cond = parseCondicoesPagamento(orcamento.condicoesPagamento);
  const existentes = await listarDespesasOrcamento(empresaId, orcamento.numeroPedido);

  if (exigeParcelamento(cond.forma)) {
    const esperado = normalizarParcelas(cond.parcelas);
    if (existentes.length === esperado) return existentes;
    await removerDespesasOrcamento(empresaId, orcamento.numeroPedido);
    return criarParcelasDespesaOrcamento(empresaId, {
      numeroPedido: orcamento.numeroPedido,
      fornecedorNome: orcamento.fornecedorNome,
      totalLiquido: valor,
      dataAprovacao: orcamento.dataAprovacao,
      parcelas: esperado,
    });
  }

  if (existentes.length === 1 && !existentes[0].descricao.includes("Parcela")) {
    return existentes;
  }

  await removerDespesasOrcamento(empresaId, orcamento.numeroPedido);

  const formaPagamento = rotuloCondicoesPagamento(cond);
  const descricao = empacotarDespesa(
    descricaoDespesaOrcamento(orcamento.numeroPedido, orcamento.fornecedorNome),
    {
      entidade: "fornecedores",
      parcela: "1/1",
      referencia: `Pedido ${orcamento.numeroPedido}`,
      nome: orcamento.fornecedorNome || "Fornecedor",
      categoria: "Orçamento",
    }
  );

  const unico = await prisma.lancamento.create({
    data: {
      empresaId,
      tipo: "despesa",
      descricao,
      valor,
      data: orcamento.dataAprovacao,
      status: "pendente",
      formaPagamento,
    },
  });

  return [unico];
}

export function condicoesPagamentoFromBody(body: {
  formaPagamento?: string;
  parcelas?: number;
  condicoesPagamento?: string;
}): string {
  if (body.formaPagamento) {
    const cond: CondicoesPagamentoOrcamento = {
      forma: body.formaPagamento as FormaPagamentoOrcamento,
      parcelas: normalizarParcelas(body.parcelas),
    };
    return serializarCondicoesPagamento(cond);
  }
  return body.condicoesPagamento ?? "";
}
