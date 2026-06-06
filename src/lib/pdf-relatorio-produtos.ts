import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import {
  LOGO_PDF_CABECALHO_OS_ALTURA_MM,
  LOGO_PDF_CABECALHO_OS_LARGURA_MM,
  normalizarLogoTamanho,
} from "@/lib/lab-impressao";
import type { LinhaControleProduto } from "@/lib/relatorio-estoque";
import { moneyRelatorioEstoque } from "@/lib/relatorio-estoque";

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

const COLUNAS: ColunaPdf[] = [
  { chave: "codigo", rotulo: "Cód Barras", largura: 18 },
  { chave: "produto", rotulo: "Produto", largura: 30 },
  { chave: "marca", rotulo: "Marca", largura: 18 },
  { chave: "estoqueAtual", rotulo: "Estoque Atual", largura: 16, align: "right", destaqueBaixo: true },
  { chave: "unidade", rotulo: "Unidade", largura: 12 },
  { chave: "minimo", rotulo: "Mínimo", largura: 12, align: "right" },
  { chave: "maximo", rotulo: "Máximo", largura: 12, align: "right" },
  { chave: "custoFmt", rotulo: "Custo", largura: 16, align: "right" },
  { chave: "vendaFmt", rotulo: "Venda", largura: 16, align: "right" },
  { chave: "totalFmt", rotulo: "Total", largura: 18, align: "right" },
];

const MARGEM = 10;
const FS_CABECALHO = 8.5;
const FS_TITULO = 11;
const FS_TABELA = 7;
const ALTURA_LINHA = 4.2;
const COR_CABECALHO_TABELA: [number, number, number] = [220, 220, 220];
const COR_ESTOQUE_BAIXO: [number, number, number] = [255, 165, 0];

function formatarGeradoEm(date: Date) {
  const data = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const hora = date.toLocaleTimeString("pt-BR", {
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
  textoY += 4.2;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(FS_CABECALHO);
  const endereco =
    lab.endereco?.trim() ||
    [lab.enderecoLinha1, lab.enderecoLinha2].filter(Boolean).join(" ");
  if (endereco) {
    pdf.text(endereco, textoX, textoY);
    textoY += 3.6;
  }
  if (lab.telefones) {
    pdf.text(lab.telefones, textoX, textoY);
    textoY += 3.6;
  }
  if (lab.email) {
    pdf.text(lab.email, textoX, textoY);
  }

  pdf.setFontSize(FS_CABECALHO);
  pdf.text(formatarGeradoEm(geradoEm), dir, MARGEM + 2, { align: "right" });

  const baseY = Math.max(textoY, y + logoH) + 4;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.line(MARGEM, baseY, larguraPagina - MARGEM, baseY);

  const tituloY = baseY + 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_TITULO);
  pdf.text(titulo, larguraPagina / 2, tituloY, { align: "center" });

  return tituloY + 6;
}

function valorCelula(linha: LinhaControleProduto, col: ColunaPdf) {
  if (col.chave === "custoFmt") return moneyRelatorioEstoque(linha.custo);
  if (col.chave === "vendaFmt") return moneyRelatorioEstoque(linha.venda);
  if (col.chave === "totalFmt") return moneyRelatorioEstoque(linha.total);
  if (col.chave === "estoqueAtual") {
    return Number.isInteger(linha.estoqueAtual)
      ? String(linha.estoqueAtual)
      : linha.estoqueAtual.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  }
  if (col.chave === "minimo" || col.chave === "maximo") {
    const valor = linha[col.chave];
    return Number.isInteger(valor) ? String(valor) : String(valor);
  }
  return String(linha[col.chave as keyof LinhaControleProduto] ?? "");
}

function alturaCelula(pdf: PdfApi, texto: string, largura: number) {
  const partes = pdf.splitTextToSize(texto || "", largura - 0.5);
  return Math.max(ALTURA_LINHA, partes.length * 3.2);
}

function desenharCabecalhoTabela(pdf: PdfApi, y: number) {
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const larguraTabela = COLUNAS.reduce((s, col) => s + col.largura, 0);
  let x = MARGEM;

  pdf.setFillColor(...COR_CABECALHO_TABELA);
  pdf.rect(MARGEM, y - 3.2, larguraTabela, 5.5, "F");

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.line(MARGEM, y - 3.2, larguraPagina - MARGEM, y - 3.2);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_TABELA);
  for (const col of COLUNAS) {
    pdf.text(col.rotulo, x, y);
    x += col.largura;
  }

  y += 2.2;
  pdf.line(MARGEM, y, MARGEM + larguraTabela, y);
  return y + 3.2;
}

function desenharLinhaTabela(pdf: PdfApi, linha: LinhaControleProduto, y: number) {
  const alturas = COLUNAS.map((col) =>
    alturaCelula(pdf, valorCelula(linha, col), col.largura)
  );
  const altura = Math.max(...alturas, ALTURA_LINHA);
  let x = MARGEM;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(FS_TABELA);

  for (const col of COLUNAS) {
    const valor = valorCelula(linha, col);
    const partes = pdf.splitTextToSize(valor, col.largura - 0.5);

    if (col.destaqueBaixo && linha.situacao === "Baixo") {
      pdf.setFillColor(...COR_ESTOQUE_BAIXO);
      pdf.rect(x, y - 2.6, col.largura, altura, "F");
      pdf.setDrawColor(0, 0, 0);
    }

    const textoX =
      col.align === "right" ? x + col.largura - 0.5 : x;
    pdf.text(partes, textoX, y, col.align === "right" ? { align: "right" } : undefined);
    x += col.largura;
  }

  const yLinha = y + altura - 1.2;
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.15);
  pdf.line(MARGEM, yLinha, pdf.internal.pageSize.getWidth() - MARGEM, yLinha);

  return yLinha + 2.4;
}

function desenharRodapeTabela(
  pdf: PdfApi,
  y: number,
  totalEstoque: number,
  totalGeral: number
) {
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const larguraTabela = COLUNAS.reduce((s, col) => s + col.largura, 0);
  let x = MARGEM;

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.line(MARGEM, y, MARGEM + larguraTabela, y);
  y += 4;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(FS_TABELA);

  for (const col of COLUNAS) {
    if (col.chave === "estoqueAtual") {
      pdf.text(`Total Estoque: ${totalEstoque}`, x, y);
    } else if (col.chave === "totalFmt") {
      pdf.text(`R$ ${moneyRelatorioEstoque(totalGeral)}`, x + col.largura - 0.5, y, {
        align: "right",
      });
    }
    x += col.largura;
  }

  void larguraPagina;
  return y + 4;
}

export async function gerarPdfRelatorioProdutos(opts: {
  lab: LabImpressaoConfig;
  titulo?: string;
  linhas: LinhaControleProduto[];
  totalGeral: number;
  geradoEm?: Date;
}) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const api = pdf as unknown as PdfApi;
  const geradoEm = opts.geradoEm ?? new Date();
  const titulo = opts.titulo ?? "Relatório de Produtos";
  const alturaPagina = api.internal.pageSize.getHeight();
  const totalEstoque = opts.linhas.reduce((s, linha) => s + linha.estoqueAtual, 0);

  let y = desenharCabecalhoPagina(api, opts.lab, titulo, geradoEm);
  y = desenharCabecalhoTabela(api, y);

  for (const linha of opts.linhas) {
    const proximaAltura = alturaCelula(api, linha.produto, 30) + 4;
    if (y + proximaAltura > alturaPagina - MARGEM - 10) {
      api.addPage();
      y = desenharCabecalhoPagina(api, opts.lab, titulo, geradoEm);
      y = desenharCabecalhoTabela(api, y);
    }
    y = desenharLinhaTabela(api, linha, y);
  }

  desenharRodapeTabela(api, y, totalEstoque, opts.totalGeral);
  return api.output("blob");
}
