import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";
import {
  criarContextoTabelaFaturasSmart,
  desenharCabecalhoPaginaFaturasSmart,
  desenharLinhaTabelaFaturasSmart,
  desenharObservacaoFaturasSmart,
  desenharTotaisFaturasSmart,
  moneyBr,
  novaPaginaTabelaFaturasSmart,
  tituloPeriodoSmart,
  type ColunaRelatorioFaturasSmart,
  type OpcoesPeriodoRelatorioFaturas,
} from "@/lib/pdf-relatorio-faturas-smart-comum";

export type OpcoesRelatorioFaturasModelo1 = OpcoesPeriodoRelatorioFaturas;

const COLUNAS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Num Fatura", larguraMm: 18, align: "center" },
  { titulo: "Qtd Parcelas", larguraMm: 22, align: "center" },
  { titulo: "Data Emissão", larguraMm: 24, align: "center" },
  { titulo: "Cliente", larguraMm: 46, align: "left" },
  { titulo: "Valor", larguraMm: 24, align: "right" },
  { titulo: "Recebido", larguraMm: 24, align: "right" },
  { titulo: "Saldo", larguraMm: 24, align: "right" },
];

const OBS_MODELO1 =
  "Obs.: Esse relatório não considera adiantamentos (crédito em haver), apenas valores das Faturas";

function qtdParcelasDaLinha(parcela: string) {
  const match = parcela.match(/\/\s*(\d+)\s*$/);
  if (match) return Number(match[1]) || 1;
  return 1;
}

function linhaValorJaRecebido(linha: LinhaRelatorioContasReceber) {
  return linha.recebido > 0.009 && linha.saldo <= 0.009;
}

function formatarDataEmissao(linha: LinhaRelatorioContasReceber) {
  const d = linha.dataLancamento;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export async function gerarRelatorioFaturasModelo1Pdf(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesRelatorioFaturasModelo1
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf, COLUNAS);

  const titulo = `Relatório de Faturas - (${tituloPeriodoSmart(opcoes.periodoCampo)})`;
  const periodoTexto = `${opcoes.dataInicio} à ${opcoes.dataFinal}`;

  desenharCabecalhoPaginaFaturasSmart(ctx, titulo, periodoTexto);

  const totalValor = linhas.reduce((s, l) => s + l.valor, 0);
  const totalRecebido = linhas.reduce((s, l) => s + l.recebido, 0);
  const totalSaldo = linhas.reduce((s, l) => s + l.saldo, 0);

  desenharLinhaTabelaFaturasSmart(
    ctx,
    COLUNAS.map((c) => c.titulo),
    { header: true }
  );

  linhas.forEach((linha) => {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    const verde = linhaValorJaRecebido(linha);
    desenharLinhaTabelaFaturasSmart(
      ctx,
      [
        String(linha.numeroFatura),
        String(qtdParcelasDaLinha(linha.parcela)),
        formatarDataEmissao(linha),
        linha.cliente,
        moneyBr(linha.valor),
        moneyBr(linha.recebido),
        moneyBr(linha.saldo),
      ],
      { verdeCols: [false, false, false, false, verde, verde, verde] }
    );
  });

  if (linhas.length === 0) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, [
      "—",
      "—",
      "—",
      "Nenhuma fatura no período",
      "0,00",
      "0,00",
      "0,00",
    ]);
  }

  desenharTotaisFaturasSmart(ctx, [
    `TOTAL FATURAS R$ ${moneyBr(totalValor)}`,
    `TOTAL RECEBIDO R$ ${moneyBr(totalRecebido)}`,
    `SALDO R$ ${moneyBr(totalSaldo)}`,
  ], 4);

  desenharObservacaoFaturasSmart(ctx, OBS_MODELO1);

  return pdf.output("blob");
}
