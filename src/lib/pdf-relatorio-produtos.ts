import type { LabImpressaoConfig } from "@/lib/lab-impressao";
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
import {
  LOGO_PDF_CABECALHO_OS_ALTURA_MM,
  LOGO_PDF_CABECALHO_OS_LARGURA_MM,
  normalizarLogoTamanho,
} from "@/lib/lab-impressao";
import type { LinhaControleProduto } from "@/lib/relatorio-estoque";
import { moneyRelatorioEstoque } from "@/lib/relatorio-estoque";
import { localeImpressaoAtual, formatMoneyImpressao } from "@/lib/i18n/print-i18n";
import { localeDataIntl } from "@/lib/i18n/tr-ui";

type PdfApi = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (size: number) => void;
  setLineWidth: (width: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  text: (text: string | string[], x: number, y: number, options?: { align?: string }) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  addPage: () => void;
  addImage: (imageData: string, format: string, x: number, y: number, w: number, h: number) => void;
  output: (type: "blob") => Blob;
};

type ColunaPdf = {
  chave: keyof LinhaControleProduto | "custoFmt" | "vendaFmt" | "totalFmt";
  rotulo: string;
  largura: number;
  align?: "left" | "right";
  destaqueBaixo?: boolean;
};

/** Pesos relativos — largura final preenche a página inteira entre as margens. */
function colunasProdutosBase(): Array<Omit<ColunaPdf, "largura">> {
  return [
    { chave: "codigo", rotulo: pl("print.relatorio.estoque.codBarras") },
    { chave: "produto", rotulo: pl("print.relatorio.estoque.produto") },
    { chave: "marca", rotulo: pl("print.relatorio.estoque.marca") },
    { chave: "estoqueAtual", rotulo: pl("print.relatorio.estoque.estoqueAtual"), align: "right", destaqueBaixo: true },
    { chave: "unidade", rotulo: pl("print.relatorio.estoque.unidade") },
    { chave: "minimo", rotulo: pl("print.relatorio.estoque.minimo"), align: "right" },
    { chave: "maximo", rotulo: pl("print.relatorio.estoque.maximo"), align: "right" },
    { chave: "custoFmt", rotulo: pl("print.relatorio.estoque.custo"), align: "right" },
    { chave: "vendaFmt", rotulo: pl("print.relatorio.estoque.venda"), align: "right" },
    { chave: "totalFmt", rotulo: pl("print.relatorio.total"), align: "right" },
  ];
}

const PESOS_COLUNAS = [12, 22, 14, 11, 9, 9, 9, 11, 11, 12];

const MARGEM = 8;
const FS_CABECALHO = 9.5;
const FS_TITULO = 13;
const FS_TABELA = 8.5;
const ALTURA_LINHA = 5;
const COR_CABECALHO_TABELA: [number, number, number] = [220, 220, 220];
const COR_ESTOQUE_BAIXO: [number, number, number] = [255, 165, 0];

function larguraUtil(pdf: PdfApi) {
  return pdf.internal.pageSize.getWidth() - MARGEM * 2;
}

function montarColunas(pdf: PdfApi): ColunaPdf[] {
  const util = larguraUtil(pdf);
  const pesoTotal = PESOS_COLUNAS.reduce((s, peso) => s + peso, 0);
  return colunasProdutosBase().map((col, index) => ({
    ...col,
    largura: (PESOS_COLUNAS[index] / pesoTotal) * util,
  }));
}

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

function escalaLogoPdf(pct: number | undefined) {
  const fator = 1 + normalizarLogoTamanho(pct) / 100;
  return {
    largura: LOGO_PDF_CABECALHO_OS_LARGURA_MM * fator,
    altura: LOGO_PDF_CABECALHO_OS_ALTURA_MM * fator,
  };
}

function desenharLogo(pdf: PdfApi, lab: LabImpressaoConfig, x: number, y: number) {
  const dataUrl = lab.logoDataUrl?.trim();
  if (!dataUrl?.startsWith("data:image")) return { largura: 0, altura: 0 };
  const { largura, altura } = escalaLogoPdf(lab.logoTamanho);
  const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
  try {
    pdf.addImage(dataUrl, fmt, x, y, largura, altura);
    return { largura, altura };
  } catch {
    return { largura: 0, altura: 0 };
  }
}

function desenharCabecalhoPagina(
  pdf: PdfApi,
  lab: LabImpressaoConfig,
  titulo: string,
  geradoEm: Date
) {
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const dir = larguraPagina - MARGEM;
  let y = MARGEM + 2;

  const { largura: logoW, altura: logoH } = desenharLogo(pdf, lab, MARGEM, y);
  const textoX = logoW > 0 ? MARGEM + logoW + 4 : MARGEM;
  let textoY = y + (logoH > 0 ? 3 : 0);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_CABECALHO + 1);
  pdf.text(lab.responsavel || lab.marca, textoX, textoY);
  textoY += 4.8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(FS_CABECALHO);
  const endereco =
    lab.endereco?.trim() ||
    [lab.enderecoLinha1, lab.enderecoLinha2].filter(Boolean).join(" ");
  if (endereco) {
    pdf.text(endereco, textoX, textoY);
    textoY += 4.2;
  }
  if (lab.telefones) {
    pdf.text(lab.telefones, textoX, textoY);
    textoY += 4.2;
  }
  if (lab.email) {
    pdf.text(lab.email, textoX, textoY);
  }

  pdf.setFontSize(FS_CABECALHO);
  pdf.text(formatarGeradoEm(geradoEm), dir, MARGEM + 2, { align: "right" });

  const baseY = Math.max(textoY, y + logoH) + 5;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.line(MARGEM, baseY, larguraPagina - MARGEM, baseY);

  const tituloY = baseY + 9;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_TITULO);
  pdf.text(titulo, larguraPagina / 2, tituloY, { align: "center" });

  return tituloY + 7;
}

function valorCelula(linha: LinhaControleProduto, col: ColunaPdf) {
  if (col.chave === "custoFmt") return moneyRelatorioEstoque(linha.custo);
  if (col.chave === "vendaFmt") return moneyRelatorioEstoque(linha.venda);
  if (col.chave === "totalFmt") return moneyRelatorioEstoque(linha.total);
  if (col.chave === "estoqueAtual") {
    return Number.isInteger(linha.estoqueAtual)
      ? String(linha.estoqueAtual)
      : linha.estoqueAtual.toLocaleString(localeDataIntl(localeImpressaoAtual()), {
          maximumFractionDigits: 3,
        });
  }
  if (col.chave === "minimo" || col.chave === "maximo") {
    const valor = linha[col.chave];
    return Number.isInteger(valor) ? String(valor) : String(valor);
  }
  return String(linha[col.chave as keyof LinhaControleProduto] ?? "");
}

function alturaCelula(pdf: PdfApi, texto: string, largura: number) {
  const partes = pdf.splitTextToSize(texto || "", largura - 1);
  return Math.max(ALTURA_LINHA, partes.length * 3.8);
}

function desenharCabecalhoTabela(pdf: PdfApi, colunas: ColunaPdf[], y: number) {
  const larguraTabela = larguraUtil(pdf);
  let x = MARGEM;

  pdf.setFillColor(...COR_CABECALHO_TABELA);
  pdf.rect(MARGEM, y - 3.8, larguraTabela, 6.5, "F");

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.line(MARGEM, y - 3.8, MARGEM + larguraTabela, y - 3.8);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_TABELA);
  for (const col of colunas) {
    const textoX = col.align === "right" ? x + col.largura - 1 : x;
    pdf.text(col.rotulo, textoX, y, col.align === "right" ? { align: "right" } : undefined);
    x += col.largura;
  }

  y += 2.6;
  pdf.line(MARGEM, y, MARGEM + larguraTabela, y);
  return y + 3.6;
}

function desenharLinhaTabela(
  pdf: PdfApi,
  colunas: ColunaPdf[],
  linha: LinhaControleProduto,
  y: number
) {
  const larguraTabela = larguraUtil(pdf);
  const alturas = colunas.map((col) =>
    alturaCelula(pdf, valorCelula(linha, col), col.largura)
  );
  const altura = Math.max(...alturas, ALTURA_LINHA);
  let x = MARGEM;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(FS_TABELA);

  for (const col of colunas) {
    const valor = valorCelula(linha, col);
    const partes = pdf.splitTextToSize(valor, col.largura - 1);

    if (col.destaqueBaixo && linha.situacao === "Baixo") {
      pdf.setFillColor(...COR_ESTOQUE_BAIXO);
      pdf.rect(x, y - 3, col.largura, altura, "F");
      pdf.setDrawColor(0, 0, 0);
    }

    const textoX = col.align === "right" ? x + col.largura - 1 : x;
    pdf.text(partes, textoX, y, col.align === "right" ? { align: "right" } : undefined);
    x += col.largura;
  }

  const yLinha = y + altura - 1.4;
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.15);
  pdf.line(MARGEM, yLinha, MARGEM + larguraTabela, yLinha);

  return yLinha + 2.8;
}

function desenharRodapeTabela(
  pdf: PdfApi,
  colunas: ColunaPdf[],
  y: number,
  totalEstoque: number,
  totalGeral: number
) {
  const larguraTabela = larguraUtil(pdf);
  let x = MARGEM;

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.line(MARGEM, y, MARGEM + larguraTabela, y);
  y += 5;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_TABELA);

  for (const col of colunas) {
    if (col.chave === "estoqueAtual") {
      pdf.text(`${pl("print.relatorio.estoque.totalEstoque")} ${totalEstoque}`, x, y);
    } else if (col.chave === "totalFmt") {
      pdf.text(formatMoneyImpressao(totalGeral), x + col.largura - 1, y, {
        align: "right",
      });
    }
    x += col.largura;
  }

  return y + 4;
}

export async function gerarPdfRelatorioProdutos(opts: {
  lab: LabImpressaoConfig;
  titulo?: string;
  linhas: LinhaControleProduto[];
  totalGeral: number;
  geradoEm?: Date;
}) {
  iniciarImpressaoRelatorio();
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const api = pdf as unknown as PdfApi;
  const colunas = montarColunas(api);
  const geradoEm = opts.geradoEm ?? new Date();
  const titulo = opts.titulo ?? pl("print.relatorio.tituloProdutos");
  const alturaPagina = api.internal.pageSize.getHeight();
  const totalEstoque = opts.linhas.reduce((s, linha) => s + linha.estoqueAtual, 0);
  const larguraProduto = colunas.find((col) => col.chave === "produto")?.largura ?? 40;

  let y = desenharCabecalhoPagina(api, opts.lab, titulo, geradoEm);
  y = desenharCabecalhoTabela(api, colunas, y);

  for (const linha of opts.linhas) {
    const proximaAltura = alturaCelula(api, linha.produto, larguraProduto) + 5;
    if (y + proximaAltura > alturaPagina - MARGEM - 10) {
      api.addPage();
      y = desenharCabecalhoPagina(api, opts.lab, titulo, geradoEm);
      y = desenharCabecalhoTabela(api, colunas, y);
    }
    y = desenharLinhaTabela(api, colunas, linha, y);
  }

  desenharRodapeTabela(api, colunas, y, totalEstoque, opts.totalGeral);
  return api.output("blob");
}
