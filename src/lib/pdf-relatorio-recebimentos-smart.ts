import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import { escalaLogoMultiplicador } from "@/lib/lab-logo";
import {
  criarContextoTabelaFaturasSmart,
  desenharLinhaTabelaFaturasSmart,
  desenharTotaisFaturasSmart,
  moneyBr,
  novaPaginaTabelaFaturasSmart,
  PRETO,
  type ColunaRelatorioFaturasSmart,
  type ContextoTabelaFaturasSmart,
  type OpcoesPeriodoRelatorioFaturas,
} from "@/lib/pdf-relatorio-faturas-smart-comum";
import type { jsPDF } from "jspdf";

const COLUNAS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Data Recebimento", larguraMm: 34, align: "center" },
  { titulo: "Forma Pagamento", larguraMm: 96, align: "left" },
  { titulo: "Valor", larguraMm: 46, align: "right" },
];

const COLUNAS_TOTAIS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Forma Pagamento", larguraMm: 130, align: "left" },
  { titulo: "Valor", larguraMm: 46, align: "right" },
];

const CINZA_BARRA: [number, number, number] = [218, 218, 218];

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

type GrupoCliente = {
  cliente: string;
  linhas: LinhaRelatorioContasReceber[];
};

function moneyRs(value: number) {
  return `R$ ${moneyBr(value)}`;
}

function agruparPorCliente(linhas: LinhaRelatorioContasReceber[]): GrupoCliente[] {
  const mapa = new Map<string, LinhaRelatorioContasReceber[]>();
  for (const linha of linhas) {
    const chave = linha.cliente.trim() || "Sem cliente informado";
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

function totaisPorForma(linhas: LinhaRelatorioContasReceber[]) {
  const mapa = new Map<string, number>();
  for (const linha of linhas) {
    const forma = (linha.formaRecebimento || "—").trim();
    mapa.set(forma, (mapa.get(forma) ?? 0) + linha.valor);
  }
  return Array.from(mapa.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR")
  );
}

function larguraTabela(ctx: ContextoTabelaFaturasSmart) {
  const ultima = ctx.colunas.length - 1;
  return ctx.colX[ultima] + ctx.colunas[ultima].larguraMm - ctx.margin;
}

/** Logo + marca à esquerda; dados do lab à direita (igual Smart Recebimentos). */
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

  const marca = (lab.marca || "DenteArt").trim();
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

function desenharTituloRelatorio(ctx: ContextoTabelaFaturasSmart) {
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(
    "Relatório de Parcelas Recebidas - Data Recebimento",
    ctx.pageW / 2,
    ctx.y,
    { align: "center" }
  );
  ctx.y += 11;
}

function desenharValorTotalGeral(ctx: ContextoTabelaFaturasSmart, total: number) {
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(11);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(`Valor Total Geral: ${moneyBr(total)}`, ctx.margin, ctx.y);
  ctx.y += 9;
}

function desenharBarraCliente(ctx: ContextoTabelaFaturasSmart, nomeCliente: string) {
  const altura = 6.8;
  novaPaginaTabelaFaturasSmart(ctx, altura + ctx.headerH + ctx.rowH * 3);
  const largura = larguraTabela(ctx);
  ctx.pdf.setFillColor(...CINZA_BARRA);
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.rect(ctx.margin, ctx.y, largura, altura, "FD");
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(8.5);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(nomeCliente.toUpperCase(), ctx.margin + 2.5, ctx.y + altura / 2 + 1.1);
  ctx.y += altura;
}

function desenharCabecalhoTabela(
  ctx: ContextoTabelaFaturasSmart,
  colunas: ColunaRelatorioFaturasSmart[]
) {
  const colsAnterior = ctx.colunas;
  const colXAnterior = ctx.colX;
  ctx.colunas = colunas;
  ctx.colX = [ctx.margin];
  for (let i = 0; i < colunas.length - 1; i++) {
    ctx.colX.push(ctx.colX[i] + colunas[i].larguraMm);
  }
  desenharLinhaTabelaFaturasSmart(
    ctx,
    colunas.map((c) => c.titulo),
    { header: true, fillHeader: true }
  );
  ctx.colunas = colsAnterior;
  ctx.colX = colXAnterior;
}

function desenharBlocoCliente(ctx: ContextoTabelaFaturasSmart, grupo: GrupoCliente) {
  desenharBarraCliente(ctx, grupo.cliente);
  desenharCabecalhoTabela(ctx, COLUNAS);

  for (const linha of grupo.linhas) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, [
      linha.vencimento,
      linha.formaRecebimento,
      moneyRs(linha.valor),
    ]);
  }

  const porForma = totaisPorForma(grupo.linhas);
  const totalCliente = grupo.linhas.reduce((s, l) => s + l.valor, 0);
  desenharTotaisFaturasSmart(
    ctx,
    [
      ...porForma.map(([forma, valor]) => `${forma}: ${moneyRs(valor)}`),
      `Total ${moneyRs(totalCliente)}`,
    ],
    2
  );
  ctx.y += 5;
}

function desenharTabelaTotaisGeral(
  ctx: ContextoTabelaFaturasSmart,
  linhas: LinhaRelatorioContasReceber[]
) {
  const porForma = totaisPorForma(linhas);
  const totalGeral = linhas.reduce((s, l) => s + l.valor, 0);

  ctx.y += 4;
  novaPaginaTabelaFaturasSmart(ctx, ctx.headerH + ctx.rowH * (porForma.length + 2));

  const colXBackup = [...ctx.colX];
  const colsBackup = ctx.colunas;
  ctx.colunas = COLUNAS_TOTAIS;
  ctx.colX = [ctx.margin];
  for (let i = 0; i < COLUNAS_TOTAIS.length - 1; i++) {
    ctx.colX.push(ctx.colX[i] + COLUNAS_TOTAIS[i].larguraMm);
  }

  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(10);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text("Totais", ctx.margin, ctx.y);
  ctx.y += 6;

  desenharLinhaTabelaFaturasSmart(
    ctx,
    COLUNAS_TOTAIS.map((c) => c.titulo),
    { header: true, fillHeader: true }
  );

  for (const [forma, valor] of porForma) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, [forma, moneyRs(valor)]);
  }

  novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
  desenharLinhaTabelaFaturasSmart(ctx, ["Total Geral", moneyRs(totalGeral)]);

  ctx.colunas = colsBackup;
  ctx.colX = colXBackup;
}

/** Layout Smart Prótese — Recebimentos (cópia do relatório Parcelas Recebidas). */
export async function gerarRelatorioRecebimentosSmartPdf(
  linhas: LinhaRelatorioContasReceber[],
  _opcoes: OpcoesPeriodoRelatorioFaturas
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  const api = pdf as unknown as PdfApi;
  const ctx = criarContextoTabelaFaturasSmart(pdf as unknown as jsPDF, COLUNAS);

  const totalGeral = linhas.reduce((s, l) => s + l.valor, 0);
  const grupos = agruparPorCliente(linhas);

  ctx.y = desenharCabecalhoRecebimentosSmart(api, margin, margin);
  desenharTituloRelatorio(ctx);

  if (grupos.length === 0) {
    desenharValorTotalGeral(ctx, totalGeral);
  } else {
    for (const grupo of grupos) {
      desenharBlocoCliente(ctx, grupo);
    }
    desenharTabelaTotaisGeral(ctx, linhas);
  }

  return pdf.output("blob");
}
