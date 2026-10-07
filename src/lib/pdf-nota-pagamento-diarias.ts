import { parseValorNumericoBr } from "@/lib/colaborador-remuneracao";
import { slugColaboradorComissao } from "@/lib/comissao-colaboradores-pagamento";
import {
  formatarHorasDecimais,
  formatarDataIsoBr,
  nomeMesAnoDiarias,
  type ResumoColaboradorDiariaMes,
} from "@/lib/diarias-colaboradores";
import type { Locale } from "@/lib/i18n";
import {
  definirLocaleImpressao,
  formatDateImpressao,
  formatMoneyImpressao,
  localeImpressaoAtual,
  pl,
  resolverLocaleImpressao,
} from "@/lib/i18n/print-i18n";
import { localeDataIntl } from "@/lib/i18n/tr-ui";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import { PRETO } from "@/lib/pdf-relatorio-faturas-smart-comum";

export type NotaPagamentoDiariasInput = ResumoColaboradorDiariaMes & {
  ano: number;
  mes: number;
};

type ColunaNota = {
  titulo: string;
  largura: number;
  align: "left" | "center" | "right";
};

function weekdayCurto(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  if (!ano || !mes || !dia) return "";
  return new Date(ano, mes - 1, dia).toLocaleDateString(localeDataIntl(localeImpressaoAtual()), {
    weekday: "short",
  });
}

function colunasNota(): ColunaNota[] {
  return [
    { titulo: pl("print.diarias.col.data"), largura: 22, align: "left" },
    { titulo: pl("print.diarias.col.dia"), largura: 16, align: "left" },
    { titulo: pl("print.diarias.col.entrada"), largura: 20, align: "center" },
    { titulo: pl("print.diarias.col.saida"), largura: 20, align: "center" },
    { titulo: pl("print.diarias.col.intervalo"), largura: 18, align: "center" },
    { titulo: pl("print.diarias.col.horas"), largura: 20, align: "right" },
    { titulo: pl("print.diarias.col.valor"), largura: 28, align: "right" },
    { titulo: pl("print.diarias.col.obs"), largura: 36, align: "left" },
  ];
}

function textoCelula(
  pdf: import("jspdf").jsPDF,
  col: ColunaNota,
  x: number,
  y: number,
  altura: number,
  texto: string,
  negrito = false
) {
  pdf.setFont("helvetica", negrito ? "bold" : "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...PRETO);
  const pad = 1.4;
  const truncado = pdf.splitTextToSize(texto || "", col.largura - pad * 2)[0] || "";
  const tx =
    col.align === "right"
      ? x + col.largura - pad
      : col.align === "center"
        ? x + col.largura / 2
        : x + pad;
  pdf.text(truncado, tx, y + altura / 2 + 1.1, { align: col.align });
}

function desenharNota(
  pdf: import("jspdf").jsPDF,
  nota: NotaPagamentoDiariasInput,
  primeiraPagina: boolean
) {
  const margin = 14;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  if (!primeiraPagina) pdf.addPage();

  const api = pdf as unknown as Parameters<typeof desenharCabecalhoLabRelatorioPdf>[0];
  let y = desenharCabecalhoLabRelatorioPdf(api, margin, margin);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...PRETO);
  pdf.text(pl("print.diarias.titulo"), pageW / 2, y, { align: "center" });
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(nomeMesAnoDiarias(nota.ano, nota.mes, localeImpressaoAtual()), pageW / 2, y, {
    align: "center",
  });
  y += 8;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(nota.colaboradorNome, margin, y);
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    `${pl("print.diarias.valorDiaria")}: ${formatMoneyImpressao(
      parseValorNumericoBr(nota.valorDiaria)
    )}    ${pl("print.diarias.jornada")}: ${formatarHorasDecimais(nota.horasJornada)}`,
    margin,
    y
  );
  y += 7;

  const colunas = colunasNota();
  const tableW = colunas.reduce((soma, col) => soma + col.largura, 0);
  const colX: number[] = [margin];
  for (let i = 0; i < colunas.length - 1; i += 1) {
    colX.push(colX[i] + colunas[i].largura);
  }
  const rowH = 6.2;
  const headerH = 7;

  const garantirEspaco = (altura: number) => {
    if (y + altura <= pageH - margin - 28) return;
    pdf.addPage();
    y = margin;
  };

  garantirEspaco(headerH + rowH);
  pdf.setFillColor(241, 245, 249);
  pdf.rect(margin, y, tableW, headerH, "F");
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.2);
  pdf.rect(margin, y, tableW, headerH);
  colunas.forEach((col, i) => {
    textoCelula(pdf, col, colX[i], y, headerH, col.titulo, true);
  });
  y += headerH;

  for (const lancamento of nota.lancamentos) {
    garantirEspaco(rowH);
    const valores = [
      formatarDataIsoBr(lancamento.data),
      weekdayCurto(lancamento.data),
      lancamento.entrada,
      lancamento.saida,
      `${lancamento.intervaloMinutos} min`,
      formatarHorasDecimais(lancamento.horas),
      formatMoneyImpressao(lancamento.valor),
      lancamento.observacao || "",
    ];
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + rowH, margin + tableW, y + rowH);
    colunas.forEach((col, i) => {
      textoCelula(pdf, col, colX[i], y, rowH, valores[i]);
    });
    y += rowH;
  }

  y += 4;
  garantirEspaco(18);
  pdf.setFillColor(239, 246, 255);
  pdf.rect(margin, y, tableW, 10, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(
    `${pl("print.diarias.total")}: ${nota.dias} ${pl("print.diarias.diasAbrev")}  ·  ${formatarHorasDecimais(nota.horas)}  ·  ${formatMoneyImpressao(nota.valor)}`,
    margin + 3,
    y + 6.5
  );
  y += 16;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const recibo = pl("print.diarias.textoRecibo", {
    valor: formatMoneyImpressao(nota.valor),
    periodo: nomeMesAnoDiarias(nota.ano, nota.mes, localeImpressaoAtual()),
    colaborador: nota.colaboradorNome,
  });
  const linhasRecibo = pdf.splitTextToSize(recibo, pageW - margin * 2);
  garantirEspaco(linhasRecibo.length * 4.5 + 28);
  pdf.text(linhasRecibo, margin, y);
  y += linhasRecibo.length * 4.5 + 16;

  garantirEspaco(28);
  const linhaY = y;
  const colAssinatura = (pageW - margin * 2 - 16) / 2;
  pdf.setDrawColor(100, 116, 139);
  pdf.line(margin, linhaY, margin + colAssinatura, linhaY);
  pdf.line(margin + colAssinatura + 16, linhaY, pageW - margin, linhaY);
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  pdf.text(pl("print.diarias.assinaturaColaborador"), margin + colAssinatura / 2, linhaY + 5, {
    align: "center",
  });
  pdf.text(pl("print.diarias.assinaturaLab"), margin + colAssinatura + 16 + colAssinatura / 2, linhaY + 5, {
    align: "center",
  });
  y = linhaY + 12;
  pdf.setFontSize(8);
  pdf.text(
    `${pl("print.diarias.emitidoEm")}: ${formatDateImpressao(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`
    )}`,
    pageW - margin,
    y,
    { align: "right" }
  );
}

export function nomeArquivoNotaDiarias(notas: NotaPagamentoDiariasInput[]) {
  const primeira = notas[0];
  const periodo = primeira
    ? `${primeira.ano}-${String(primeira.mes).padStart(2, "0")}`
    : "periodo";
  if (notas.length === 1) {
    return `nota-diarias-${slugColaboradorComissao(primeira.colaboradorNome)}-${periodo}.pdf`;
  }
  return `notas-diarias-${periodo}.pdf`;
}

export async function gerarNotaPagamentoDiariasPdf(
  notas: NotaPagamentoDiariasInput[],
  locale?: Locale
): Promise<Blob> {
  definirLocaleImpressao(resolverLocaleImpressao({ locale }));
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({ title: pl("print.diarias.titulo") });
  notas.forEach((nota, indice) => desenharNota(pdf, nota, indice === 0));
  return pdf.output("blob");
}
