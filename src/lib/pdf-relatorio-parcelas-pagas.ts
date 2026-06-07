import { jsPDF } from "jspdf";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import {
  criarContextoTabelaFaturasSmart,
  desenharLinhaTabelaFaturasSmart,
  moneyBr,
  novaPaginaTabelaFaturasSmart,
  PRETO,
  type ColunaRelatorioFaturasSmart,
  type ContextoTabelaFaturasSmart,
} from "@/lib/pdf-relatorio-faturas-smart-comum";
import {
  montarSecoesParcelasPagas,
  totalParcelasPagas,
  type SecaoParcelasPagas,
} from "@/lib/relatorio-parcelas-pagas-dados";

export type OpcoesRelatorioParcelasPagas = {
  lancamentos: Array<{
    id: string;
    tipo: string;
    descricao: string;
    valor: number;
    data: string;
    status: string;
    formaPagamento?: string | null;
    cliente?: { id?: string; nome: string } | null;
    trabalho?: { numeroOs: number } | null;
  }>;
  idsIncluidos: Set<string>;
};

const CINZA_FUNDO: [number, number, number] = [238, 238, 238];

const COLUNAS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Nome", larguraMm: 34, align: "left" },
  { titulo: "Ref", larguraMm: 16, align: "center" },
  { titulo: "Parcela", larguraMm: 16, align: "center" },
  { titulo: "Venc", larguraMm: 18, align: "center" },
  { titulo: "Pagamento", larguraMm: 22, align: "center" },
  { titulo: "Forma Pagamento", larguraMm: 28, align: "center" },
  { titulo: "Valor", larguraMm: 18, align: "right" },
  { titulo: "Juros", larguraMm: 14, align: "right" },
  { titulo: "Pago", larguraMm: 16, align: "right" },
];

function desenharTitulo(ctx: ContextoTabelaFaturasSmart) {
  const titulo = "Relatório de Parcelas Pagas - ( Data Pagamento )";
  ctx.y = desenharCabecalhoLabRelatorioPdf(ctx.api, ctx.margin, ctx.y);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(titulo, ctx.pageW / 2, ctx.y, { align: "center" });
  ctx.y += 10;
}

function desenharBarraCategoria(ctx: ContextoTabelaFaturasSmart, titulo: string) {
  const largura = ctx.pageW - ctx.margin * 2;
  novaPaginaTabelaFaturasSmart(ctx, ctx.headerH + 4);
  ctx.pdf.setFillColor(...CINZA_FUNDO);
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.rect(ctx.margin, ctx.y, largura, ctx.headerH, "FD");
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(titulo, ctx.margin + largura / 2, ctx.y + ctx.headerH / 2 + 1.2, {
    align: "center",
  });
  ctx.y += ctx.headerH;
}

function desenharRodapeSecao(ctx: ContextoTabelaFaturasSmart, secao: SecaoParcelasPagas) {
  novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
  desenharLinhaTabelaFaturasSmart(
    ctx,
    [
      "",
      "",
      "",
      "",
      "",
      "Total",
      `R$ ${moneyBr(secao.totalValor)}`,
      `R$ ${moneyBr(secao.totalJuros)}`,
      `R$ ${moneyBr(secao.totalPago)}`,
    ],
    { header: true, fillHeader: false }
  );
}

function desenharSecao(ctx: ContextoTabelaFaturasSmart, secao: SecaoParcelasPagas) {
  desenharBarraCategoria(ctx, secao.categoria.label);

  desenharLinhaTabelaFaturasSmart(
    ctx,
    COLUNAS.map((c) => c.titulo),
    { header: true, fillHeader: true }
  );

  for (const linha of secao.linhas) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, [
      linha.nome,
      linha.ref,
      linha.parcela,
      linha.venc,
      linha.pagamento,
      linha.formaPagamento,
      moneyBr(linha.valor),
      moneyBr(linha.juros),
      moneyBr(linha.pago),
    ]);
  }

  desenharRodapeSecao(ctx, secao);
  ctx.y += 4;
}

export function gerarRelatorioParcelasPagasPdf(opcoes: OpcoesRelatorioParcelasPagas): Blob {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf, COLUNAS);

  desenharTitulo(ctx);

  const secoes = montarSecoesParcelasPagas(opcoes.lancamentos, opcoes.idsIncluidos);
  const totalGeral = totalParcelasPagas(secoes);

  for (const secao of secoes) {
    desenharSecao(ctx, secao);
  }

  ctx.y += 2;
  novaPaginaTabelaFaturasSmart(ctx, 8);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(10);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(`TOTAL PAGO ${moneyBr(totalGeral)}`, ctx.margin, ctx.y + 2);

  const buffer = pdf.output("arraybuffer");
  return new Blob([buffer], { type: "application/pdf" });
}
