import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import { escalaLogoMultiplicador } from "@/lib/lab-logo";
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
import type { jsPDF } from "jspdf";

const CINZA_FUNDO: [number, number, number] = [238, 238, 238];

const COLUNAS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Data Recebimento", larguraMm: 40, align: "center" },
  { titulo: "Forma Pagamento", larguraMm: 96, align: "center" },
  { titulo: "Valor", larguraMm: 46, align: "right" },
];

export type OpcoesRelatorioRecebimentosSmart = OpcoesPeriodoRelatorioFaturas & {
  agruparPorCliente?: boolean;
};

type PdfApi = {
  internal: {
    pageSize: { getWidth: () => number; getHeight: () => number };
    getNumberOfPages: () => number;
  };
  setFont: (font: string, style?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setLineWidth: (width: number) => void;
  text: (
    text: string | string[],
    x: number,
    y: number,
    options?: { align?: "left" | "center" | "right" }
  ) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) => void;
  addPage: () => void;
  rect: (
    x: number,
    y: number,
    w: number,
    h: number,
    style?: "S" | "F" | "FD"
  ) => void;
};

function moneyRs(value: number) {
  return `R$ ${moneyBr(value)}`;
}

function dataRecebimentoLinha(linha: LinhaRelatorioContasReceber) {
  return linha.dataRecebimento ?? linha.vencimento;
}

function formaPagamentoLinha(linha: LinhaRelatorioContasReceber) {
  return linha.formaRecebimento && linha.formaRecebimento !== "—"
    ? linha.formaRecebimento
    : "";
}

function agruparLinhasPorCliente(linhas: LinhaRelatorioContasReceber[]) {
  const mapa = new Map<string, LinhaRelatorioContasReceber[]>();
  for (const linha of linhas) {
    const chave = linha.cliente.trim();
    if (!chave) continue;
    const lista = mapa.get(chave) ?? [];
    lista.push(linha);
    mapa.set(chave, lista);
  }
  return Array.from(mapa.entries())
    .map(([cliente, grupoLinhas]) => ({
      cliente,
      linhas: grupoLinhas.sort(
        (a, b) => a.dataOrdenacao.getTime() - b.dataOrdenacao.getTime()
      ),
    }))
    .sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"));
}

/** Cabeçalho Recebimentos (completo) — logo à esquerda, dados do lab à direita. */
export function desenharCabecalhoRecebimentosSmart(
  pdf: PdfApi,
  margin: number,
  yInicio: number
): number {
  const lab = labImpressaoFromConfig();
  const pageW = pdf.internal.pageSize.getWidth();
  let yTop = yInicio;
  let logoW = 0;
  let logoH = 0;
  let blocoEsquerdaFim = yTop;

  const dataUrl = lab.logoDataUrl?.trim();
  if (dataUrl?.startsWith("data:image")) {
    const s = escalaLogoMultiplicador(lab.logoTamanho);
    logoW = 20 * s;
    logoH = 20 * s;
    const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
    try {
      pdf.addImage(dataUrl, fmt, margin, yTop, logoW, logoH);
      blocoEsquerdaFim = yTop + logoH;
    } catch {
      logoW = 0;
      logoH = 0;
    }
  }

  const marca = (lab.marca || NOME_LAB_PADRAO).trim();
  if (marca) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(51, 51, 51);
    const xMarca = logoW > 0 ? margin + logoW / 2 : margin;
    const yMarca = blocoEsquerdaFim + (logoH > 0 ? 5 : 4);
    pdf.text(marca, xMarca, yMarca, { align: logoW > 0 ? "center" : "left" });
    blocoEsquerdaFim = yMarca + 4;
  }

  const xDir = pageW - margin;
  let yDir = yTop + 2;
  pdf.setTextColor(51, 51, 51);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.text(marca || lab.responsavel || "", xDir, yDir, { align: "right" });
  yDir += 4.2;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  const endereco =
    lab.enderecoLinha1 && lab.enderecoLinha2
      ? `${lab.enderecoLinha1}, ${lab.enderecoLinha2}`
      : lab.endereco || lab.enderecoLinha1 || "";
  for (const bloco of [endereco, lab.telefones, lab.email].filter(Boolean)) {
    const linhasTxt = pdf.splitTextToSize(bloco, 78);
    pdf.text(linhasTxt, xDir, yDir, { align: "right" });
    yDir += linhasTxt.length * 3.6;
  }

  const y = Math.max(blocoEsquerdaFim, yDir) + 4;
  pdf.setDrawColor(190, 190, 190);
  pdf.setLineWidth(0.35);
  pdf.line(margin, y, pageW - margin, y);
  return y + 8;
}

function desenharCabecalhoPagina(ctx: ContextoTabelaFaturasSmart) {
  ctx.y = desenharCabecalhoLabRelatorioPdf(ctx.api, ctx.margin, ctx.y);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(
    "Relatório de Parcelas Recebidas - (Data Recebimento)",
    ctx.pageW / 2,
    ctx.y,
    { align: "center" }
  );
  ctx.y += 10;
}

function desenharBarraCliente(ctx: ContextoTabelaFaturasSmart, cliente: string) {
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
  ctx.pdf.text(cliente, ctx.margin + largura / 2, ctx.y + altura / 2 + 1.2, {
    align: "center",
  });
  ctx.y += altura;
}

function valoresLinhaRecebimento(linha: LinhaRelatorioContasReceber) {
  return [
    dataRecebimentoLinha(linha),
    formaPagamentoLinha(linha),
    moneyBr(linha.valor),
  ];
}

function desenharLinhaTotalGrupo(ctx: ContextoTabelaFaturasSmart, total: number) {
  const altura = ctx.rowH;
  novaPaginaTabelaFaturasSmart(ctx, altura);
  const valores = ["", "Total", moneyRs(total)];

  ctx.colunas.forEach((col, i) => {
    const x = ctx.colX[i];
    const w = col.larguraMm;
    ctx.pdf.setDrawColor(0, 0, 0);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.rect(x, ctx.y, w, altura);
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...PRETO);
    const pad = 2;
    const texto = valores[i] ?? "";
    const truncado = ctx.pdf.splitTextToSize(texto, w - pad * 2)[0] || texto;
    const tx =
      col.align === "right"
        ? x + w - pad
        : col.align === "center"
          ? x + w / 2
          : x + pad;
    ctx.pdf.text(truncado, tx, ctx.y + altura / 2 + 1.2, { align: col.align });
  });
  ctx.y += altura;
}

function desenharTabelaRecebimentos(
  ctx: ContextoTabelaFaturasSmart,
  linhasGrupo: LinhaRelatorioContasReceber[],
  opts?: { barraCliente?: string }
) {
  if (opts?.barraCliente) {
    desenharBarraCliente(ctx, opts.barraCliente);
  }

  desenharLinhaTabelaFaturasSmart(
    ctx,
    COLUNAS.map((c) => c.titulo),
    { header: true, fillHeader: true }
  );

  for (const linha of linhasGrupo) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, valoresLinhaRecebimento(linha));
  }

  const total = linhasGrupo.reduce((s, l) => s + l.valor, 0);
  desenharLinhaTotalGrupo(ctx, total);
  ctx.y += 4;
}

function desenharTotalRecebido(ctx: ContextoTabelaFaturasSmart, total: number) {
  ctx.y += 2;
  if (ctx.y + 10 > ctx.pageH - ctx.margin) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
  }
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(10);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(`TOTAL RECEBIDO ${moneyRs(total)}`, ctx.margin, ctx.y + 4);
  ctx.y += 8;
}

/** Layout Smart Prótese — Recebimentos (Parcelas Recebidas). */
export async function gerarRelatorioRecebimentosSmartPdf(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesRelatorioRecebimentosSmart
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf as unknown as jsPDF, COLUNAS);

  desenharCabecalhoPagina(ctx);

  const totalGeral = linhas.reduce((s, l) => s + l.valor, 0);
  const agruparCliente = opcoes.agruparPorCliente !== false;

  if (linhas.length === 0) {
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setFontSize(10);
    ctx.pdf.text("Nenhum recebimento no período.", ctx.margin, ctx.y);
  } else if (agruparCliente) {
    for (const grupo of agruparLinhasPorCliente(linhas)) {
      desenharTabelaRecebimentos(ctx, grupo.linhas, { barraCliente: grupo.cliente });
    }
  } else {
    desenharTabelaRecebimentos(ctx, linhas);
  }

  desenharTotalRecebido(ctx, totalGeral);

  return pdf.output("blob");
}
