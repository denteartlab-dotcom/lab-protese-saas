import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import type { LinhaAgendaPdf } from "@/lib/agenda-producao";
import { iniciarImpressaoRelatorio, pl } from "@/lib/i18n/print-relatorio-helpers";
import { localeDataIntl } from "@/lib/i18n/tr-ui";
import { localeImpressaoAtual } from "@/lib/i18n/print-i18n";

type PdfApi = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (size: number) => void;
  setLineWidth: (width: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  text: (text: string | string[], x: number, y: number, options?: { align?: string }) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  addPage: () => void;
  output: (type: "blob") => Blob;
};

type LinhaAgendaTabela = Omit<LinhaAgendaPdf, "prazoOrdenacao">;

function colunasAgenda() {
  return [
    { chave: "os" as const, rotulo: pl("print.relatorio.agenda.os"), largura: 11 },
    { chave: "caixa" as const, rotulo: pl("print.relatorio.agenda.caixa"), largura: 13 },
    { chave: "prazo" as const, rotulo: pl("print.relatorio.agenda.prazo"), largura: 27 },
    { chave: "qtd" as const, rotulo: pl("print.relatorio.agenda.qtd"), largura: 9 },
    { chave: "servico" as const, rotulo: pl("print.relatorio.agenda.servico"), largura: 28 },
    { chave: "cliente" as const, rotulo: pl("print.relatorio.agenda.cliente"), largura: 28 },
    { chave: "paciente" as const, rotulo: pl("print.relatorio.agenda.paciente"), largura: 24 },
    { chave: "colaborador" as const, rotulo: pl("print.relatorio.agenda.colaborador"), largura: 24 },
    { chave: "etapas" as const, rotulo: pl("print.relatorio.agenda.etapas"), largura: 26 },
  ];
}

const MARGEM = 10;
const FS_CABECALHO = 8.5;
const FS_TITULO = 11;
const FS_TABELA = 7;
const ALTURA_LINHA = 4.2;

function formatarGeradoEm(date: Date) {
  const tag = localeDataIntl(localeImpressaoAtual());
  const data = date.toLocaleDateString(tag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const hora = date.toLocaleTimeString(tag, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${data} ${hora}`;
}

function desenharCabecalhoPagina(
  pdf: PdfApi,
  lab: LabImpressaoConfig,
  titulo: string,
  geradoEm: Date
) {
  const dir = pdf.internal.pageSize.getWidth() - MARGEM;
  let y = MARGEM + 2;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_CABECALHO + 1);
  pdf.text(lab.responsavel || lab.marca, MARGEM, y);
  y += 4.2;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(FS_CABECALHO);
  const endereco =
    lab.endereco?.trim() ||
    [lab.enderecoLinha1, lab.enderecoLinha2].filter(Boolean).join(" ");
  if (endereco) {
    pdf.text(endereco, MARGEM, y);
    y += 3.6;
  }
  if (lab.telefones) {
    pdf.text(lab.telefones, MARGEM, y);
    y += 3.6;
  }
  if (lab.email) {
    pdf.text(lab.email, MARGEM, y);
  }

  pdf.setFontSize(FS_CABECALHO);
  pdf.text(formatarGeradoEm(geradoEm), dir, MARGEM + 2, { align: "right" });

  const tituloY = MARGEM + 22;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_TITULO);
  pdf.text(titulo, pdf.internal.pageSize.getWidth() / 2, tituloY, { align: "center" });

  return tituloY + 6;
}

function desenharCabecalhoTabela(pdf: PdfApi, y: number) {
  const colunas = colunasAgenda();
  const larguraPagina = pdf.internal.pageSize.getWidth();
  let x = MARGEM;

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.line(MARGEM, y, larguraPagina - MARGEM, y);
  y += 3.5;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_TABELA);
  for (const col of colunas) {
    pdf.text(col.rotulo, x, y);
    x += col.largura;
  }

  y += 2.2;
  pdf.line(MARGEM, y, larguraPagina - MARGEM, y);
  return y + 3.2;
}

function alturaCelula(pdf: PdfApi, texto: string, largura: number) {
  const partes = pdf.splitTextToSize(texto || "", largura - 0.5);
  return Math.max(ALTURA_LINHA, partes.length * 3.2);
}

function desenharLinhaTabela(pdf: PdfApi, linha: LinhaAgendaTabela, y: number) {
  const colunas = colunasAgenda();
  let x = MARGEM;
  const alturas = colunas.map((col) =>
    alturaCelula(pdf, String(linha[col.chave] ?? ""), col.largura)
  );
  const altura = Math.max(...alturas, ALTURA_LINHA);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(FS_TABELA);

  for (const col of colunas) {
    const valor = String(linha[col.chave] ?? "");
    const partes = pdf.splitTextToSize(valor, col.largura - 0.5);
    pdf.text(partes, x, y);
    x += col.largura;
  }

  const yLinha = y + altura - 1.2;
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.15);
  pdf.line(MARGEM, yLinha, pdf.internal.pageSize.getWidth() - MARGEM, yLinha);

  return yLinha + 2.4;
}

export async function gerarPdfAgendaProducao(opts: {
  lab: LabImpressaoConfig;
  titulo?: string;
  linhas: LinhaAgendaPdf[];
  geradoEm?: Date;
}) {
  iniciarImpressaoRelatorio();
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const api = pdf as unknown as PdfApi;
  const geradoEm = opts.geradoEm ?? new Date();
  const titulo = opts.titulo ?? pl("print.relatorio.agenda.titulo");
  const alturaPagina = api.internal.pageSize.getHeight();
  const linhasSemOrdenacao = opts.linhas.map(({ prazoOrdenacao: _ordenacao, ...rest }) => rest);

  let y = desenharCabecalhoPagina(api, opts.lab, titulo, geradoEm);
  y = desenharCabecalhoTabela(api, y);

  for (const linha of linhasSemOrdenacao) {
    const proximaAltura = alturaCelula(api, linha.servico, 28) + 4;
    if (y + proximaAltura > alturaPagina - MARGEM) {
      api.addPage();
      y = desenharCabecalhoPagina(api, opts.lab, titulo, geradoEm);
      y = desenharCabecalhoTabela(api, y);
    }
    y = desenharLinhaTabela(api, linha, y);
  }

  return api.output("blob");
}
