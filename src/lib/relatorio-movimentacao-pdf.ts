import type { LinhaFluxoCaixa } from "@/lib/fluxo-de-caixa";
import { inicioFimPeriodo } from "@/lib/fluxo-de-caixa";
import { dateToBrShort } from "@/lib/datas-br";
import type { Locale } from "@/lib/i18n";
import { formatMoneyImpressao, formatDateImpressao } from "@/lib/i18n/print-i18n";
import {
  iniciarImpressaoRelatorio,
  pl,
} from "@/lib/i18n/print-relatorio-helpers";
import {
  traduzirContaPdf,
  traduzirDescricaoPdf,
  traduzirFormaPagamentoPdf,
} from "@/lib/i18n/relatorio-print-i18n";
import { localeDataIntl } from "@/lib/i18n/tr-ui";

export type DadosRelatorioMovimentacao = {
  linhas: LinhaFluxoCaixa[];
  contaLabel: string;
  periodoLabel: string;
  dataImpressao: string;
  totalGeral: number;
  locale?: Locale;
};

function moneyPdf(value: number) {
  return formatMoneyImpressao(value, undefined, false);
}

export function labelPeriodoFluxoCaixa(
  periodo: string,
  dataInicio: string,
  dataFim: string,
  locale?: Locale
) {
  iniciarImpressaoRelatorio({ locale });
  const { inicio, fim } = inicioFimPeriodo(periodo, dataInicio, dataFim);
  const tag = localeDataIntl(locale ?? "pt");
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString(tag) : "");
  if (periodo === "todos") return pl("print.relatorio.movimentacao.periodoTodos");
  const ini = fmt(inicio) || dataInicio || "—";
  const end = fmt(fim) || dataFim || "—";
  return pl("print.relatorio.periodoIntervalo", { inicio: ini, fim: end });
}

export async function gerarRelatorioMovimentacaoPdf(
  dados: DadosRelatorioMovimentacao
): Promise<Blob> {
  iniciarImpressaoRelatorio({ locale: dados.locale });
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const footerH = 10;
  const colWidths = [22, 58, 28, 32, 24, 24];
  const colX = [margin];
  for (let i = 0; i < colWidths.length - 1; i++) {
    colX.push(colX[i] + colWidths[i]);
  }
  const tableW = colWidths.reduce((s, w) => s + w, 0);
  const rowH = 6;
  const headerH = 7;
  let y = margin;

  function novaPaginaSeNecessario(altura: number) {
    if (y + altura > pageH - margin - footerH) {
      pdf.addPage();
      y = margin;
      desenharCabecalhoTabela();
    }
  }

  function desenharCabecalhoTabela() {
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, y, tableW, headerH, "F");
    pdf.setDrawColor(229, 231, 235);
    pdf.rect(margin, y, tableW, headerH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    const headers = [
      pl("print.extrato.data"),
      pl("print.relatorio.col.descricao"),
      pl("print.relatorio.col.forma"),
      pl("print.relatorio.col.conta"),
      pl("print.relatorio.col.valor"),
      pl("print.extrato.saldo"),
    ];
    headers.forEach((h, i) => {
      const align = i >= 4 ? "right" : "left";
      const x = i >= 4 ? colX[i] + colWidths[i] - 2 : colX[i] + 2;
      pdf.text(h, x, y + 4.5, { align: align as "left" | "right" });
    });
    y += headerH;
    pdf.setTextColor(55, 65, 81);
    pdf.setFont("helvetica", "normal");
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(51, 51, 51);
  pdf.text(pl("print.relatorio.movimentacao.titulo"), margin, y);
  y += 9;

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(pl("print.relatorio.movimentacao.conta", { conta: dados.contaLabel }), margin, y);
  pdf.text(
    pl("print.relatorio.movimentacao.periodo", { periodo: dados.periodoLabel }),
    pageW - margin,
    y,
    { align: "right" }
  );
  y += 5;
  pdf.text(
    pl("print.relatorio.movimentacao.totalGeral", { valor: moneyPdf(dados.totalGeral) }),
    margin,
    y
  );
  pdf.text(
    pl("print.relatorio.movimentacao.dataImpressao", { data: dados.dataImpressao }),
    pageW - margin,
    y,
    { align: "right" }
  );
  y += 10;

  desenharCabecalhoTabela();

  pdf.setFontSize(9);
  for (let idx = 0; idx < dados.linhas.length; idx++) {
    const linha = dados.linhas[idx];
    const alturaLinha = rowH;
    novaPaginaSeNecessario(alturaLinha);

    if (idx % 2 === 1) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, y, tableW, alturaLinha, "F");
    }
    pdf.setDrawColor(243, 244, 246);
    pdf.line(margin, y + alturaLinha, margin + tableW, y + alturaLinha);

    const valorTxt =
      linha.kind === "saldo_inicial" ? moneyPdf(0) : moneyPdf(linha.valor);
    const cells = [
      linha.dataLabel,
      traduzirDescricaoPdf(linha.descricao),
      traduzirFormaPagamentoPdf(linha.forma),
      traduzirContaPdf(linha.conta),
      valorTxt,
      moneyPdf(linha.saldo),
    ];

    cells.forEach((texto, i) => {
      const truncated =
        i === 1
          ? pdf.splitTextToSize(texto, colWidths[i] - 4)[0] || texto
          : texto;
      const x = i >= 4 ? colX[i] + colWidths[i] - 2 : colX[i] + 2;
      pdf.text(truncated, x, y + 4, {
        align: (i >= 4 ? "right" : "left") as "left" | "right",
      });
    });

    y += alturaLinha;
  }

  if (dados.linhas.length === 0) {
    novaPaginaSeNecessario(rowH);
    pdf.text(pl("print.relatorio.movimentacao.semDados"), margin + 2, y + 4);
    y += rowH;
  }

  const totalPaginas = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text(
      pl("print.relatorio.paginaDe", {
        pagina: String(i),
        total: String(totalPaginas),
      }),
      pageW / 2,
      pageH - 6,
      { align: "center" }
    );
  }

  return pdf.output("blob");
}

export function dataImpressaoHoje() {
  return dateToBrShort(new Date());
}
