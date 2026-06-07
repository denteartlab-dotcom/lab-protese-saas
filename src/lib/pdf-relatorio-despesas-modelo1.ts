import type { LinhaRelatorioDespesa } from "@/lib/relatorio-despesas";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import {
  criarContextoTabelaFaturasSmart,
  desenharLinhaTabelaFaturasSmart,
  desenharTotaisFaturasSmart,
  moneyBr,
  novaPaginaTabelaFaturasSmart,
  PRETO,
  tituloPeriodoSmart,
  type ColunaRelatorioFaturasSmart,
  type ContextoTabelaFaturasSmart,
  type OpcoesPeriodoRelatorioFaturas,
} from "@/lib/pdf-relatorio-faturas-smart-comum";

export type OpcoesRelatorioDespesasModelo1 = OpcoesPeriodoRelatorioFaturas;

const COLUNAS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Data Emissão", larguraMm: 22, align: "left" },
  { titulo: "Qtd Parcelas", larguraMm: 18, align: "center" },
  { titulo: "Referência", larguraMm: 20, align: "left" },
  { titulo: "Fornecedor", larguraMm: 42, align: "left" },
  { titulo: "Valor", larguraMm: 22, align: "right" },
  { titulo: "Juros", larguraMm: 18, align: "right" },
  { titulo: "Pago", larguraMm: 20, align: "right" },
  { titulo: "Saldo", larguraMm: 20, align: "right" },
];

function qtdParcelasDaLinha(parcela: string) {
  const match = parcela.match(/\/\s*(\d+)\s*$/);
  if (match) return Number(match[1]) || 1;
  return 1;
}

function formatarDataEmissao(linha: LinhaRelatorioDespesa) {
  const d = linha.dataOrdenacao;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function valoresLinhaDespesa(linha: LinhaRelatorioDespesa) {
  const pago = linha.status === "pago" ? linha.valor : 0;
  const saldo = linha.status === "pago" ? 0 : linha.valor;
  return {
    pago,
    saldo,
    juros: 0,
  };
}

function desenharCabecalhoDespesasModelo1(ctx: ContextoTabelaFaturasSmart, titulo: string) {
  ctx.y = desenharCabecalhoLabRelatorioPdf(ctx.api, ctx.margin, ctx.y);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(titulo, ctx.pageW / 2, ctx.y, { align: "center" });
  ctx.y += 10;
}

export async function gerarRelatorioDespesasModelo1Pdf(
  linhas: LinhaRelatorioDespesa[],
  opcoes: OpcoesRelatorioDespesasModelo1
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf, COLUNAS);

  const titulo = `Relatório de Despesas - (${tituloPeriodoSmart(opcoes.periodoCampo)})`;
  desenharCabecalhoDespesasModelo1(ctx, titulo);

  const totalValor = linhas.reduce((s, l) => s + l.valor, 0);
  const totalPago = linhas.reduce((s, l) => s + valoresLinhaDespesa(l).pago, 0);
  const totalSaldo = linhas.reduce((s, l) => s + valoresLinhaDespesa(l).saldo, 0);

  desenharLinhaTabelaFaturasSmart(
    ctx,
    COLUNAS.map((c) => c.titulo),
    { header: true }
  );

  linhas.forEach((linha) => {
    const { pago, saldo, juros } = valoresLinhaDespesa(linha);
    const paga = linha.status === "pago";
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(
      ctx,
      [
        formatarDataEmissao(linha),
        String(qtdParcelasDaLinha(linha.parcela)),
        linha.referencia?.trim() || "",
        linha.nome,
        moneyBr(linha.valor),
        moneyBr(juros),
        moneyBr(pago),
        moneyBr(saldo),
      ],
      { verdeCols: [paga, false, false, false, false, false, false, false] }
    );
  });

  if (linhas.length === 0) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, [
      "—",
      "—",
      "",
      "Nenhuma despesa no período",
      "0,00",
      "0,00",
      "0,00",
      "0,00",
    ]);
  }

  desenharTotaisFaturasSmart(
    ctx,
    [
      `TOTAL FATURAS R$ ${moneyBr(totalValor)}`,
      `TOTAL PAGO R$ ${moneyBr(totalPago)}`,
      `SALDO DEVEDOR R$ ${moneyBr(totalSaldo)}`,
    ],
    4
  );

  return pdf.output("blob");
}
