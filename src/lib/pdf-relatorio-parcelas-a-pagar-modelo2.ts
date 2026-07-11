import { jsPDF } from "jspdf";
import {
  iniciarImpressaoRelatorio,
  moneyRelatorio,
  obsFaturasSemAdiantamento,
  periodoRelatorioTexto,
  pl,
  tituloExtratoFinanceiro,
  tituloRelatorioDespesas,
  tituloRelatorioFaturas,
  tituloRelatorioParcelasAPagar,
  tituloRelatorioParcelasAReceber,
  tituloPeriodoCampo,
} from "@/lib/i18n/print-relatorio-helpers";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import {
  criarContextoTabelaFaturasSmart,
  desenharLinhaTabelaFaturasSmart,
  moneyBr,
  novaPaginaTabelaFaturasSmart,
  PRETO,
  type ColunaRelatorioFaturasSmart,
  type ContextoTabelaFaturasSmart,
  type OpcoesPeriodoRelatorioFaturas,
} from "@/lib/pdf-relatorio-faturas-smart-comum";
import {
  montarGruposParcelasAPagarModelo2,
  type GrupoParcelasAPagarModelo2,
} from "@/lib/relatorio-parcelas-a-pagar-modelo2-dados";

export type OpcoesRelatorioParcelasAPagarModelo2 = OpcoesPeriodoRelatorioFaturas & {
  lancamentos: Array<{
    id: string;
    tipo: string;
    descricao: string;
    valor: number;
    data: string;
    status: string;
    formaPagamento?: string | null;
  }>;
  idsIncluidos: Set<string>;
};

const CINZA_FUNDO: [number, number, number] = [238, 238, 238];

function colunasRelatorio(): ColunaRelatorioFaturasSmart[] {
  return [
  { titulo: pl("print.relatorio.col.num"), larguraMm: 30, align: "left" },
  { titulo: pl("print.relatorio.col.parcela"), larguraMm: 24, align: "center" },
  { titulo: pl("print.relatorio.col.vencimento"), larguraMm: 28, align: "center" },
  { titulo: pl("print.relatorio.col.formaPagamento"), larguraMm: 52, align: "center" },
  { titulo: pl("print.relatorio.col.valorParcela"), larguraMm: 48, align: "right" },
];
}

function tituloPeriodoParcelasAPagarModelo2(
  campo: OpcoesPeriodoRelatorioFaturas["periodoCampo"]
) {
  return campo === "data_lancamento" ? "Data Lançamento" : "Data Vencimento";
}

function desenharTitulo(ctx: ContextoTabelaFaturasSmart, periodoCampo: OpcoesPeriodoRelatorioFaturas["periodoCampo"]) {
  const titulo = tituloRelatorioParcelasAPagar(periodoCampo);
  ctx.y = desenharCabecalhoLabRelatorioPdf(ctx.api, ctx.margin, ctx.y);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(titulo, ctx.pageW / 2, ctx.y, { align: "center" });
  ctx.y += 10;
}

function desenharBarraFornecedor(ctx: ContextoTabelaFaturasSmart, fornecedor: string) {
  const largura = ctx.pageW - ctx.margin * 2;
  novaPaginaTabelaFaturasSmart(ctx, ctx.headerH + 4);
  ctx.pdf.setFillColor(...CINZA_FUNDO);
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.rect(ctx.margin, ctx.y, largura, ctx.headerH, "FD");
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(fornecedor, ctx.margin + largura / 2, ctx.y + ctx.headerH / 2 + 1.2, {
    align: "center",
  });
  ctx.y += ctx.headerH;
}

function desenharRodapeGrupo(ctx: ContextoTabelaFaturasSmart, total: number) {
  novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
  desenharLinhaTabelaFaturasSmart(
    ctx,
    ["", "", "", "Total", `R$ ${moneyBr(total)}`],
    { header: true, fillHeader: false }
  );
}

function desenharTotalPagoGrupo(ctx: ContextoTabelaFaturasSmart, total: number) {
  ctx.y += 4;
  novaPaginaTabelaFaturasSmart(ctx, 8);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(10);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(`TOTAL PAGO R$ ${moneyBr(total)}`, ctx.margin, ctx.y + 2);
  ctx.y += 10;
}

function desenharGrupo(ctx: ContextoTabelaFaturasSmart, grupo: GrupoParcelasAPagarModelo2) {
  desenharBarraFornecedor(ctx, grupo.fornecedor);

  desenharLinhaTabelaFaturasSmart(
    ctx,
    colunasRelatorio().map((c) => c.titulo),
    { header: true, fillHeader: true }
  );

  for (const linha of grupo.linhas) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, [
      linha.num,
      linha.parcela,
      linha.vencimento,
      linha.formaPagamento,
      moneyBr(linha.valor),
    ]);
  }

  desenharRodapeGrupo(ctx, grupo.total);
  desenharTotalPagoGrupo(ctx, grupo.total);
}

export function gerarRelatorioParcelasAPagarModelo2Pdf(
  opcoes: OpcoesRelatorioParcelasAPagarModelo2
): Blob {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf, colunasRelatorio());

  desenharTitulo(ctx, opcoes.periodoCampo);

  const grupos = montarGruposParcelasAPagarModelo2(
    opcoes.lancamentos,
    opcoes.idsIncluidos
  );

  if (grupos.length === 0) {
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setFontSize(10);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text("Nenhuma parcela a pagar no período.", ctx.margin, ctx.y);
  } else {
    for (const grupo of grupos) {
      desenharGrupo(ctx, grupo);
      ctx.y += 4;
    }
  }

  const buffer = pdf.output("arraybuffer");
  return new Blob([buffer], { type: "application/pdf" });
}
