import type { jsPDF } from "jspdf";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import {
  LOGO_PDF_CABECALHO_OS_ALTURA_MM,
  LOGO_PDF_CABECALHO_OS_LARGURA_MM,
  PDF_JSPDF_FOLHA_A4_PAISAGEM,
} from "@/lib/lab-impressao";
import type { GrupoOsPainelServicos } from "@/lib/painel-servicos-dashboard";
import { translate, type Locale, type MessageKey } from "@/lib/i18n";
import { labelStatusTrabalho } from "@/lib/i18n/status-trabalho-i18n";
import { iniciarImpressaoRelatorio } from "@/lib/i18n/print-relatorio-helpers";

type GerarPdfServicosPainelOpts = {
  lab: LabImpressaoConfig;
  grupos: GrupoOsPainelServicos[];
  titulo: string;
  locale?: Locale;
};

type GerarPdfServicosVencendoOpts = {
  lab: LabImpressaoConfig;
  grupos: GrupoOsPainelServicos[];
  tituloPeriodo: string;
  locale?: Locale;
};

type ColunaPdf = {
  chave: keyof ReturnType<typeof linhaGrupoPdf>;
  tituloKey: MessageKey;
  peso: number;
  alinhar?: "left" | "center" | "right";
};

const MARGEM_MM = 10;
const ALTURA_LINHA_TEXTO = 3.4;
const PADDING_CELULA = 1.6;
const FONTE_CORPO = 7;
const FONTE_CABECALHO_TABELA = 7.5;

const COLUNAS: ColunaPdf[] = [
  { chave: "os", tituloKey: "dashboard.os", peso: 8, alinhar: "center" },
  { chave: "cliente", tituloKey: "dashboard.cliente", peso: 18, alinhar: "left" },
  { chave: "servicos", tituloKey: "dashboard.servicos", peso: 28, alinhar: "left" },
  { chave: "paciente", tituloKey: "dashboard.paciente", peso: 16, alinhar: "left" },
  { chave: "situacao", tituloKey: "dashboard.situacao", peso: 12, alinhar: "left" },
  { chave: "colaborador", tituloKey: "dashboard.colaborador", peso: 14, alinhar: "left" },
  { chave: "prazoLab", tituloKey: "dashboard.prazoLab", peso: 12, alinhar: "center" },
  { chave: "prazoDent", tituloKey: "dashboard.prazoDentista", peso: 12, alinhar: "center" },
];

function truncar(texto: string, max = 120) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (!limpo || limpo === "—") return "—";
  if (limpo.length <= max) return limpo;
  return `${limpo.slice(0, max - 1)}…`;
}

function linhaGrupoPdf(grupo: GrupoOsPainelServicos, locale: Locale) {
  const t = (key: MessageKey, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  return {
    os: String(grupo.numeroOs),
    cliente: truncar(grupo.clienteNome, 48),
    servicos: truncar(grupo.servicos.join(", "), 90),
    paciente: truncar(grupo.pacienteNome, 40),
    situacao: truncar(labelStatusTrabalho(t, grupo.status), 28),
    colaborador: truncar(grupo.colaborador, 36),
    prazoLab: grupo.prazoLab === "—" ? "—" : grupo.prazoLab,
    prazoDent: grupo.prazoDent === "—" ? "—" : grupo.prazoDent,
  };
}

function largurasColunas(tableW: number) {
  const pesoTotal = COLUNAS.reduce((s, c) => s + c.peso, 0);
  return COLUNAS.map((col) => (col.peso / pesoTotal) * tableW);
}

function linhasCelula(doc: jsPDF, texto: string, largura: number) {
  const limpo = String(texto || "—").trim() || "—";
  return doc.splitTextToSize(limpo, Math.max(4, largura - PADDING_CELULA * 2));
}

function alturaLinhaTabela(
  doc: jsPDF,
  linha: ReturnType<typeof linhaGrupoPdf>,
  larguras: number[]
) {
  let maxLinhas = 1;
  COLUNAS.forEach((col, i) => {
    const qtd = linhasCelula(doc, String(linha[col.chave]), larguras[i]).length;
    maxLinhas = Math.max(maxLinhas, qtd);
  });
  return maxLinhas * ALTURA_LINHA_TEXTO + PADDING_CELULA * 2;
}

function desenharCabecalhoLaboratorio(doc: jsPDF, lab: LabImpressaoConfig, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const logo = lab.logoDataUrl?.trim();

  if (logo?.startsWith("data:image")) {
    try {
      const formato = logo.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(
        logo,
        formato,
        MARGEM_MM,
        y,
        LOGO_PDF_CABECALHO_OS_LARGURA_MM,
        LOGO_PDF_CABECALHO_OS_ALTURA_MM
      );
    } catch {
      /* ignora logo inválido */
    }
  }

  const infoX = MARGEM_MM + LOGO_PDF_CABECALHO_OS_LARGURA_MM + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(lab.responsavel || lab.marca || "Laboratório", infoX, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(lab.endereco || lab.enderecoLinha1 || "", infoX, y + 10);
  doc.text(lab.telefones || "", infoX, y + 14);
  doc.text(lab.email || "", infoX, y + 18);

  y += LOGO_PDF_CABECALHO_OS_ALTURA_MM + 4;
  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.line(MARGEM_MM, y, pageW - MARGEM_MM, y);
  return y + 8;
}

function desenharTituloRelatorio(doc: jsPDF, titulo: string, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(titulo, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.line(MARGEM_MM, y, pageW - MARGEM_MM, y);
  return y + 4;
}

function desenharLinhaGrade(
  doc: jsPDF,
  x0: number,
  y: number,
  larguras: number[],
  altura: number,
  espessura = 0.15
) {
  const tableW = larguras.reduce((s, w) => s + w, 0);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(espessura);
  doc.rect(x0, y, tableW, altura);

  let x = x0;
  for (let i = 0; i < larguras.length - 1; i++) {
    x += larguras[i];
    doc.line(x, y, x, y + altura);
  }
}

function desenharCabecalhoTabela(
  doc: jsPDF,
  x0: number,
  y: number,
  larguras: number[],
  locale: Locale
) {
  const altura = ALTURA_LINHA_TEXTO + PADDING_CELULA * 2;
  desenharLinhaGrade(doc, x0, y, larguras, altura, 0.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONTE_CABECALHO_TABELA);

  let x = x0;
  for (let i = 0; i < COLUNAS.length; i++) {
    const col = COLUNAS[i];
    const w = larguras[i];
    const textoX =
      col.alinhar === "center"
        ? x + w / 2
        : col.alinhar === "right"
          ? x + w - PADDING_CELULA
          : x + PADDING_CELULA;
    doc.text(translate(locale, col.tituloKey), textoX, y + PADDING_CELULA + ALTURA_LINHA_TEXTO * 0.85, {
      align: col.alinhar ?? "left",
    });
    x += w;
  }

  return y + altura;
}

function desenharLinhaDados(
  doc: jsPDF,
  linha: ReturnType<typeof linhaGrupoPdf>,
  x0: number,
  y: number,
  larguras: number[]
) {
  const altura = alturaLinhaTabela(doc, linha, larguras);
  desenharLinhaGrade(doc, x0, y, larguras, altura);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONTE_CORPO);

  let x = x0;
  for (let i = 0; i < COLUNAS.length; i++) {
    const col = COLUNAS[i];
    const w = larguras[i];
    const linhas = linhasCelula(doc, String(linha[col.chave]), w);
    const blocoH = linhas.length * ALTURA_LINHA_TEXTO;
    const offsetY = (altura - blocoH) / 2;

    linhas.forEach((texto: string, idx: number) => {
      const textoX =
        col.alinhar === "center"
          ? x + w / 2
          : col.alinhar === "right"
            ? x + w - PADDING_CELULA
            : x + PADDING_CELULA;
      doc.text(texto, textoX, y + offsetY + ALTURA_LINHA_TEXTO * (idx + 0.85), {
        align: col.alinhar ?? "left",
      });
    });

    x += w;
  }

  return y + altura;
}

export async function gerarPdfServicosVencendo({
  lab,
  grupos,
  tituloPeriodo,
  locale,
}: GerarPdfServicosVencendoOpts): Promise<Blob> {
  iniciarImpressaoRelatorio({ locale });
  const loc = locale ?? "pt";
  return gerarPdfServicosPainel({
    lab,
    grupos,
    titulo: translate(loc, "dashboard.servicosVencendoAte", { periodo: tituloPeriodo }),
    locale: loc,
  });
}

export async function gerarPdfServicosAtrasados({
  lab,
  grupos,
  locale,
}: Omit<GerarPdfServicosPainelOpts, "titulo">): Promise<Blob> {
  iniciarImpressaoRelatorio({ locale });
  const loc = locale ?? "pt";
  const ordenados = [...grupos].sort((a, b) => a.numeroOs - b.numeroOs);
  return gerarPdfServicosPainel({
    lab,
    grupos: ordenados,
    titulo: translate(loc, "dashboard.servicosAtrasadosN", { n: ordenados.length }),
    locale: loc,
  });
}

async function gerarPdfServicosPainel({
  lab,
  grupos,
  titulo,
  locale = "pt",
}: GerarPdfServicosPainelOpts): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF(PDF_JSPDF_FOLHA_A4_PAISAGEM);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const tableW = pageW - MARGEM_MM * 2;
  const larguras = largurasColunas(tableW);
  const x0 = MARGEM_MM;
  const msgVazio = translate(locale, "dashboard.nenhumServicoFiltro");

  let y = desenharCabecalhoLaboratorio(doc, lab, MARGEM_MM);
  y = desenharTituloRelatorio(doc, titulo, y);
  y = desenharCabecalhoTabela(doc, x0, y, larguras, locale);

  const linhas = grupos.map((g) => linhaGrupoPdf(g, locale));

  for (const linha of linhas) {
    const altura = alturaLinhaTabela(doc, linha, larguras);
    if (y + altura > pageH - MARGEM_MM) {
      doc.addPage();
      y = MARGEM_MM;
      y = desenharCabecalhoTabela(doc, x0, y, larguras, locale);
    }
    y = desenharLinhaDados(doc, linha, x0, y, larguras);
  }

  if (linhas.length === 0) {
    const altura = alturaLinhaTabela(
      doc,
      {
        os: "—",
        cliente: msgVazio,
        servicos: "—",
        paciente: "—",
        situacao: "—",
        colaborador: "—",
        prazoLab: "—",
        prazoDent: "—",
      },
      larguras
    );
    if (y + altura > pageH - MARGEM_MM) {
      doc.addPage();
      y = MARGEM_MM;
    }
    desenharLinhaGrade(doc, x0, y, larguras, altura);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(FONTE_CORPO);
    doc.text(msgVazio, x0 + PADDING_CELULA, y + altura / 2 + 1);
  }

  return doc.output("blob");
}
