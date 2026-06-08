import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import {
  criarContextoTabelaFaturasSmart,
  desenharLinhaTabelaFaturasSmart,
  desenharObservacaoFaturasSmart,
  desenharTotaisFaturasSmart,
  moneyBr,
  novaPaginaTabelaFaturasSmart,
  PRETO,
  tituloPeriodoSmart,
  type ColunaRelatorioFaturasSmart,
  type ContextoTabelaFaturasSmart,
  type OpcoesPeriodoRelatorioFaturas,
} from "@/lib/pdf-relatorio-faturas-smart-comum";
import {
  montarBlocosFaturasModelo2,
  type FaturaModelo2Bloco,
} from "@/lib/relatorio-faturas-modelo2-dados";

const CINZA_FUNDO: [number, number, number] = [238, 238, 238];

/** Layout Smart Prótese — Faturas Modelo 2 (parcelas): bloco por fatura. */
const COLUNAS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Parcela", larguraMm: 20, align: "center" },
  { titulo: "Vencimento", larguraMm: 26, align: "center" },
  { titulo: "Forma Pagamento", larguraMm: 44, align: "left" },
  { titulo: "Valor", larguraMm: 22, align: "right" },
  { titulo: "Juros", larguraMm: 18, align: "right" },
  { titulo: "Recebido", larguraMm: 22, align: "right" },
];

const OBS_MODELO2 =
  "Obs.: Esse relatório não considera adiantamentos (crédito em haver), apenas valores das Faturas";

function desenharCabecalhoPagina(ctx: ContextoTabelaFaturasSmart, titulo: string) {
  ctx.y = desenharCabecalhoLabRelatorioPdf(ctx.api, ctx.margin, ctx.y);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(titulo, ctx.pageW / 2, ctx.y, { align: "center" });
  ctx.y += 10;
}

function desenharBarraFatura(ctx: ContextoTabelaFaturasSmart, texto: string) {
  const largura = ctx.pageW - ctx.margin * 2;
  const altura = ctx.headerH;
  novaPaginaTabelaFaturasSmart(ctx, altura + 4);
  ctx.pdf.setFillColor(...CINZA_FUNDO);
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.rect(ctx.margin, ctx.y, largura, altura, "FD");
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(texto, ctx.margin + 2, ctx.y + altura / 2 + 1.2);
  ctx.y += altura;
}

function desenharTotaisGeraisEsquerda(ctx: ContextoTabelaFaturasSmart, linhasResumo: string[]) {
  ctx.y += 2;
  for (const texto of linhasResumo) {
    if (ctx.y + ctx.rowH > ctx.pageH - ctx.margin - 10) {
      ctx.pdf.addPage();
      ctx.y = ctx.margin;
    }
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text(texto, ctx.margin, ctx.y + 4);
    ctx.y += 6;
  }
}

function desenharBlocoFatura(ctx: ContextoTabelaFaturasSmart, bloco: FaturaModelo2Bloco) {
  desenharBarraFatura(
    ctx,
    `Fatura: ${bloco.numero} - ${bloco.cliente} - Data Emissão ${bloco.dataEmissao}`
  );

  desenharLinhaTabelaFaturasSmart(
    ctx,
    COLUNAS.map((c) => c.titulo),
    { header: true, fillHeader: true }
  );

  if (bloco.parcelas.length === 0) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, ["—", "—", "—", "0,00", "0,00", "0,00"]);
  } else {
    for (const parcela of bloco.parcelas) {
      novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
      desenharLinhaTabelaFaturasSmart(ctx, [
        parcela.parcela,
        parcela.vencimento,
        parcela.formaPagamento,
        moneyBr(parcela.valor),
        moneyBr(parcela.juros),
        moneyBr(parcela.recebido),
      ]);
    }
  }

  desenharTotaisFaturasSmart(
    ctx,
    [
      `TOTAL FATURA R$ ${moneyBr(bloco.totalFatura)}`,
      `TOTAL RECEBIDO R$ ${moneyBr(bloco.totalRecebido)}`,
      `SALDO R$ ${moneyBr(bloco.saldo)}`,
    ],
    3
  );

  ctx.y += 4;
}

export async function gerarRelatorioFaturasModelo2Pdf(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesPeriodoRelatorioFaturas
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf, COLUNAS);

  const titulo = `Relatório de Faturas - (${tituloPeriodoSmart(opcoes.periodoCampo)})`;
  desenharCabecalhoPagina(ctx, titulo);

  const blocos = montarBlocosFaturasModelo2(linhas);

  if (blocos.length === 0) {
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setFontSize(10);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text("Nenhuma fatura no período.", ctx.margin, ctx.y);
  } else {
    for (const bloco of blocos) {
      desenharBlocoFatura(ctx, bloco);
    }

    const totalFaturas = blocos.reduce((s, b) => s + b.totalFatura, 0);
    const totalRecebido = blocos.reduce((s, b) => s + b.totalRecebido, 0);
    const saldo = blocos.reduce((s, b) => s + b.saldo, 0);

    desenharTotaisGeraisEsquerda(ctx, [
      `TOTAL FATURAS R$ ${moneyBr(totalFaturas)}`,
      `TOTAL RECEBIDO R$ ${moneyBr(totalRecebido)}`,
      `SALDO R$ ${moneyBr(saldo)}`,
    ]);
  }

  desenharObservacaoFaturasSmart(ctx, OBS_MODELO2);

  return pdf.output("blob");
}
