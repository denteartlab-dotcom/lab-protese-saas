import { randomUUID } from "crypto";
import { calcularMatrizDre, type LancamentoDre } from "@/lib/dre";
import { gerarRelatorioDreDetalhadoPdf } from "@/lib/dre-relatorio-detalhado-pdf";
import {
  IDS_CATEGORIAS_DRE_DETALHADO_PADRAO,
  montarRelatorioDreDetalhadoItens,
  type DreCategoriaRelatorioId,
} from "@/lib/dre-relatorio-detalhado";
import { montarRelatorioDreMes, dreMesSemDados } from "@/lib/dre-relatorio";
import { gerarRelatorioDrePdf } from "@/lib/dre-relatorio-pdf";
import {
  CONTAS_BANCARIAS_STORAGE_KEY,
  MOVIMENTACOES_CONTA_STORAGE_KEY,
  type ContaBancaria,
  type MovimentacaoContaBancaria,
} from "@/lib/conta-bancaria";
import { calcularFluxoDeCaixa } from "@/lib/fluxo-de-caixa";
import { findLancamentosFinanceiro } from "@/lib/lancamentos-cobranca";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  PLANO_CONTAS_PADRAO,
  PLANO_CONTAS_STORAGE_KEY,
  PLANO_CONTAS_STORAGE_VERSION,
  PLANO_CONTAS_STORAGE_VERSION_KEY,
  type ItemPlanoContas,
} from "@/lib/plano-contas";
import {
  MENSAGEM_RELATORIO_SEM_DADOS,
  type PayloadDrePdf,
  type PayloadFluxoCaixaPdf,
  type ResultadoRelatorioPdfJob,
} from "@/lib/relatorio-pdf-schema";
import { salvarRelatorioPdfTemp } from "@/lib/relatorio-pdf-temp-servidor";
import {
  dataImpressaoHoje,
  gerarRelatorioMovimentacaoPdf,
  labelPeriodoFluxoCaixa,
} from "@/lib/relatorio-movimentacao-pdf";

async function blobParaBase64(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  return buffer.toString("base64");
}

async function carregarPlanoContasServidor(empresaId: string): Promise<ItemPlanoContas[]> {
  const [versaoSalva, itens] = await Promise.all([
    lerJsonStoreTenant<string | number>(empresaId, PLANO_CONTAS_STORAGE_VERSION_KEY),
    lerJsonStoreTenant<ItemPlanoContas[]>(empresaId, PLANO_CONTAS_STORAGE_KEY),
  ]);
  const lista = Array.isArray(itens) && itens.length > 0 ? itens : PLANO_CONTAS_PADRAO;
  const versaoOk =
    versaoSalva != null && String(versaoSalva) === String(PLANO_CONTAS_STORAGE_VERSION);
  return versaoOk ? lista : PLANO_CONTAS_PADRAO;
}

async function carregarLancamentosServidor(empresaId: string): Promise<LancamentoDre[]> {
  const rows = await findLancamentosFinanceiro({
    where: { empresaId },
    orderBy: { data: "desc" },
  });
  return rows.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    descricao: l.descricao,
    valor: l.valor,
    data: l.data.toISOString(),
    status: l.status,
    formaPagamento: l.formaPagamento,
  }));
}

async function carregarContasServidor(empresaId: string): Promise<ContaBancaria[]> {
  const raw = await lerJsonStoreTenant<ContaBancaria[]>(empresaId, CONTAS_BANCARIAS_STORAGE_KEY);
  return Array.isArray(raw) ? raw.filter((c) => !c.excluida) : [];
}

async function carregarMovimentacoesServidor(
  empresaId: string
): Promise<MovimentacaoContaBancaria[]> {
  const raw = await lerJsonStoreTenant<MovimentacaoContaBancaria[]>(
    empresaId,
    MOVIMENTACOES_CONTA_STORAGE_KEY
  );
  return Array.isArray(raw) ? raw : [];
}

function publicarPdfJob(
  empresaId: string,
  blob: Blob,
  titulo: string,
  nomeArquivo: string
): Promise<ResultadoRelatorioPdfJob> {
  const pdfId = `rel-${randomUUID()}`;
  return blobParaBase64(blob).then((base64) => {
    salvarRelatorioPdfTemp(pdfId, empresaId, { base64, nomeArquivo, titulo });
    return {
      semDados: false,
      pdfId,
      titulo,
      nomeArquivo,
      url: `/api/relatorios/pdf/${pdfId}`,
    };
  });
}

export async function gerarRelatorioDrePdfServidor(
  empresaId: string,
  params: PayloadDrePdf
): Promise<ResultadoRelatorioPdfJob> {
  const [lancamentos, planoContas] = await Promise.all([
    carregarLancamentosServidor(empresaId),
    carregarPlanoContasServidor(empresaId),
  ]);

  const titulo = `Demonstrativo de Resultado ${params.mesIndex + 1}/${params.ano}`;

  if (dreMesSemDados(lancamentos, params.ano, params.mesIndex)) {
    return {
      semDados: true,
      titulo,
      mensagem: MENSAGEM_RELATORIO_SEM_DADOS,
    };
  }

  const matriz = calcularMatrizDre(lancamentos, params.ano, planoContas);

  if (params.tipoRelatorio === "detalhado") {
    const categorias = (params.categorias?.length
      ? params.categorias
      : IDS_CATEGORIAS_DRE_DETALHADO_PADRAO) as DreCategoriaRelatorioId[];
    const relatorio = montarRelatorioDreDetalhadoItens(
      matriz,
      params.mesIndex,
      planoContas,
      categorias
    );
    const blob = await gerarRelatorioDreDetalhadoPdf(relatorio);
    return publicarPdfJob(
      empresaId,
      blob,
      relatorio.titulo,
      `relatorio-dre-detalhado-${params.mesIndex + 1}-${params.ano}.pdf`
    );
  }

  const relatorio = montarRelatorioDreMes(matriz, params.mesIndex, planoContas, "resumo");
  const blob = await gerarRelatorioDrePdf(relatorio);
  return publicarPdfJob(
    empresaId,
    blob,
    relatorio.titulo,
    `relatorio-dre-${params.mesIndex + 1}-${params.ano}.pdf`
  );
}

export async function gerarRelatorioFluxoCaixaPdfServidor(
  empresaId: string,
  params: PayloadFluxoCaixaPdf
): Promise<ResultadoRelatorioPdfJob> {
  const [lancamentos, contas, movimentacoes] = await Promise.all([
    carregarLancamentosServidor(empresaId),
    carregarContasServidor(empresaId),
    carregarMovimentacoesServidor(empresaId),
  ]);

  const resultado = calcularFluxoDeCaixa(
    lancamentos,
    movimentacoes,
    contas,
    {
      conta: params.conta,
      tipo: params.tipo,
      formaPagamento: params.formaPagamento,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      modo: "diario",
    },
    params.periodo,
    params.situacao
  );

  const contaLabel =
    params.conta === "Todos"
      ? "Todas"
      : contas.find((c) => c.id === params.conta || c.nome === params.conta)?.nome ??
        params.conta;

  const blob = await gerarRelatorioMovimentacaoPdf({
    linhas: resultado.linhas,
    contaLabel,
    periodoLabel: labelPeriodoFluxoCaixa(params.periodo, params.dataInicio, params.dataFim),
    dataImpressao: dataImpressaoHoje(),
    totalGeral: resultado.saldoFinal,
  });

  return publicarPdfJob(
    empresaId,
    blob,
    "Relatório Movimentação — Fluxo de Caixa",
    "relatorio-movimentacao.pdf"
  );
}
