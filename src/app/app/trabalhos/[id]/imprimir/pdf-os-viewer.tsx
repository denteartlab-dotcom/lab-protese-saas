"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { prepararAbaPdf, visualizarPdfUrl } from "@/lib/pdf-viewer";
import { LAB_IMPRESSAO_PADRAO, type LabImpressaoConfig } from "@/lib/lab-impressao";
import {
  carregarConfigLaboratorio,
  LAB_CONFIG_ATUALIZADA_EVENT,
} from "@/lib/configuracoes-lab";
import { normalizarCabecalhoRequisicao, type CabecalhoRequisicaoConfig } from "@/lib/cabecalho-requisicao";
import { CONFIG_OS_ATUALIZADA_EVENT, carregarLayoutModelo1 } from "@/lib/configuracoes-os";
import {
  hexParaRgb,
  normalizarOsModelo1Layout,
  type OsModelo1Layout,
} from "@/lib/os-modelo1-layout";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import { desenharCabecalhoRequisicaoPdf } from "@/lib/pdf-cabecalho-os";

type PdfItem = {
  qtd: string;
  descricao: string;
  dente: string;
  cor: string;
  unitario: number;
  desconto: string;
  notasAbaixo?: string[];
};

type PdfOsData = {
  numeroOs: number;
  /** Usuário que criou a OS (log de auditoria). */
  usuarioCriou?: string;
  dataEntrada: string;
  status: string;
  cliente: string;
  dentista: string;
  paciente: string;
  caixa: string;
  telefones: string;
  email: string;
  endereco: string;
  lab?: LabImpressaoConfig;
  cabecalhoRequisicao?: CabecalhoRequisicaoConfig;
  valor: number;
  prazo: string;
  prazoLaboratorio: string;
  prazoDentista: string;
  materiais: string;
  observacoes: string;
  /** Linha de prazo abaixo do serviço (garantia se notasAbaixo não vier no item). */
  prazoLinhaServico?: string;
  layoutModelo1?: OsModelo1Layout;
  osExterna?: string;
  finalizado?: string;
  colaborador?: string;
  etapas?: string;
  urgente?: boolean;
  repeticao?: boolean;
  itens: PdfItem[];
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function unitarioTabela(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function descontoCelula(desconto: string) {
  const texto = (desconto || "").trim();
  if (!texto) return "% 0.00";
  return texto;
}

function desenharLinhaPrazo(
  pdf: {
    setFont: (fontName: string, fontStyle?: string) => void;
    text: (text: string, x: number, y: number) => void;
    getTextWidth: (text: string) => number;
  },
  nota: string,
  x: number,
  y: number
) {
  const match = nota.match(/^(Prazo:\s*[^:]+:\s*)(.+)$/i);
  if (!match) {
    pdf.setFont("helvetica", "normal");
    pdf.text(nota, x, y);
    return;
  }
  pdf.setFont("helvetica", "normal");
  pdf.text(match[1], x, y);
  const prefixWidth = pdf.getTextWidth(match[1]);
  pdf.setFont("helvetica", "bold");
  pdf.text(match[2], x + prefixWidth, y);
  pdf.setFont("helvetica", "normal");
}

function labelValue(
  pdf: {
    setFont: (fontName: string, fontStyle?: string) => void;
    text: (text: string, x: number, y: number, options?: { align?: "left" | "center" | "right" }) => void;
    getTextWidth: (text: string) => number;
  },
  label: string,
  value: string,
  x: number,
  y: number,
  emptyValue = "-"
) {
  pdf.setFont("helvetica", "normal");
  pdf.text(label, x, y);
  pdf.setFont("helvetica", "bold");
  pdf.text(value || emptyValue, x + pdf.getTextWidth(label) + 1.5, y);
  pdf.setFont("helvetica", "normal");
}

const code39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  "*": "nwnnwnwnn",
};

function drawCode39(
  pdf: {
    rect: (x: number, y: number, w: number, h: number, style?: string) => void;
    setFillColor: (r: number, g?: number, b?: number) => void;
  },
  value: string,
  x: number,
  y: number
) {
  const content = `*${value.toUpperCase().replace(/[^0-9A-Z-. ]/g, "")}*`;
  const narrow = 0.26;
  const wide = narrow * 3;
  const height = 8;
  let cursor = x;

  pdf.setFillColor(0, 0, 0);
  for (const char of content) {
    const pattern = code39[char] || code39["-"];
    pattern.split("").forEach((part, index) => {
      const width = part === "w" ? wide : narrow;
      if (index % 2 === 0) {
        pdf.rect(cursor, y, width, height, "F");
      }
      cursor += width;
    });
    cursor += narrow;
  }
}

function criarPdf(formato: string) {
  const formatos: Record<string, string | [number, number]> = {
    a4: "a4",
    termica: [80, 297],
    etiquetas: [100, 150],
  };
  return formatos[formato] || "a4";
}

type PdfRenderApi = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (size: number) => void;
  setLineWidth: (width: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  text: (text: string | string[], x: number, y: number, options?: { align?: string }) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  addPage: (format?: number | number[]) => void;
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) => void;
  output: (type: "blob") => Blob;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  getTextWidth: (text: string) => number;
  setFillColor: (r: number, g?: number, b?: number) => void;
};

const ESPACO_APOS_OS_EXTERNA_MM = 60;

function desenharMetaOsCabecalhoDireita(
  pdf: PdfRenderApi,
  data: PdfOsData,
  yDir: number,
  dir: number,
  layout?: OsModelo1Layout
) {
  const lay = layout ?? normalizarOsModelo1Layout(null);
  const desenharRotuloValorDireita = (rotulo: string, valor: string, y: number) => {
    pdf.setFont("helvetica", "bold");
    const wRotulo = pdf.getTextWidth(rotulo);
    pdf.setFont("helvetica", "normal");
    const wValor = pdf.getTextWidth(valor);
    const xInicio = dir - (wRotulo + wValor);

    pdf.setFont("helvetica", "bold");
    pdf.text(rotulo, xInicio, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(valor, xInicio + wRotulo, y);
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(String(data.numeroOs), dir, yDir, { align: "right" });
  yDir += 6;

  if (lay.dataOs) {
    pdf.setFontSize(8.5);
    desenharRotuloValorDireita("Data: ", data.dataEntrada?.trim() || "—", yDir);
    yDir += 4.5;
  }

  const usuario = (data.usuarioCriou || "").trim();
  if (lay.usuario && usuario) {
    desenharRotuloValorDireita("Usuário: ", usuario, yDir);
    yDir += 4.5;
  }
  return yDir;
}

function desenharMarcadoresUrgenciaRepeticao(pdf: PdfRenderApi, data: PdfOsData, xRotulo: number, y: number) {
  const marcas: string[] = [];
  if (data.urgente) marcas.push("URGENTE");
  if (data.repeticao) marcas.push("REPETIÇÃO");
  if (!marcas.length) return;

  const x = xRotulo + ESPACO_APOS_OS_EXTERNA_MM;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  let yMarc = y;
  for (const texto of marcas) {
    pdf.text(texto, x, yMarc);
    yMarc += 5.5;
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
}

function desenharBordaPaginaPdf(pdf: PdfRenderApi, corHex: string) {
  const { r, g, b } = hexParaRgb(corHex);
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margem = 8;
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(0.35);
  pdf.rect(margem, margem, pw - margem * 2, ph - margem * 2);
}

function renderModeloProducao(pdf: PdfRenderApi, data: PdfOsData) {
  const lay = normalizarOsModelo1Layout(data.layoutModelo1);
  const fontBase = Math.max(7, lay.tamanhoFonte * 0.53);
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = desenharCabecalhoRequisicaoPdf(pdf, {
    lab: data.lab,
    cabecalhoRequisicao: data.cabecalhoRequisicao,
    tituloDireita: "Ordem de Serviço",
    exibirLogo: lay.logo,
    exibirInfoLab: lay.infoLab,
    extrasDireita: (yDir, _m, dir) =>
      desenharMetaOsCabecalhoDireita(pdf, data, yDir, dir, lay),
  });

  pdf.setFontSize(fontBase);
  if (lay.numOs) {
    labelValue(pdf, "Núm OS:", String(data.numeroOs), 15, y);
  }
  if (lay.osExterna) {
    pdf.setFont("helvetica", "normal");
    pdf.text("OS Externa:", 110, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(data.osExterna || "—", 110 + pdf.getTextWidth("OS Externa:") + 1.5, y);
    pdf.setFont("helvetica", "normal");
  }
  if (lay.numOs || lay.osExterna) {
    desenharMarcadoresUrgenciaRepeticao(pdf, data, 110, y);
    y += 5;
  }
  if (lay.cliente) {
    labelValue(pdf, "Cliente:", data.cliente, 15, y);
  }
  if (lay.caixa) {
    labelValue(pdf, "Caixa:", data.caixa, 110, y, "");
  }
  if (lay.cliente || lay.caixa) y += 5;
  if (lay.dentista) {
    labelValue(pdf, "Dentista:", data.dentista, 15, y);
  }
  if (lay.clienteTel) {
    pdf.text(`Telefones: ${data.telefones}`, 110, y);
  }
  if (lay.dentista || lay.clienteTel) y += 5;
  if (lay.paciente) {
    labelValue(pdf, "Paciente:", data.paciente, 15, y);
  }
  if (lay.clienteEnd) {
    pdf.text(`Endereço: ${data.endereco}`, 110, y);
  }
  if (lay.paciente || lay.clienteEnd) y += 5;
  if (lay.clienteEmail) {
    pdf.text(`Email: ${data.email}`, lay.clienteTel ? 15 : 110, y);
    y += 5;
  }

  y += 3;
  pdf.line(15, y, pageWidth - 15, y);
  y += 5;

  const tableLeft = 15;
  const tableRight = pageWidth - 15;
  const colQtd = tableLeft;
  const colDesc = 28;
  let colDente = 112;
  let colCor = 132;
  let colUnit = 158;
  let colDescPct = tableRight;
  if (lay.subtotal) {
    colDescPct = tableRight - 22;
    colUnit = colDescPct - 26;
    colCor = colUnit - 26;
    colDente = colCor - 20;
  }

  pdf.setFontSize(fontBase + 1);
  pdf.setFont("helvetica", "bold");
  pdf.text("Qtd", colQtd, y);
  pdf.text("Descrição", colDesc, y);
  if (lay.numDente) pdf.text("Número Dente", colDente, y, { align: "center" });
  if (lay.corDente) pdf.text("Cor", colCor, y, { align: "center" });
  if (lay.valorUnit) pdf.text("Unitário", colUnit, y, { align: "right" });
  if (lay.desconto) pdf.text("Desc", colDescPct, y, { align: "right" });
  if (lay.subtotal) pdf.text("Subtotal", tableRight, y, { align: "right" });
  y += 3;
  pdf.line(tableLeft, y, tableRight, y);
  y += 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontBase);
  let servicoIndex = 0;
  data.itens.forEach((item) => {
    if (y > 265) {
      pdf.addPage();
      y = 16;
    }
    const descricaoLinhas = pdf.splitTextToSize(String(item.descricao), lay.subtotal ? 58 : 68);
    const ehProduto = /\(\s*Produto\s*\)/i.test(String(item.descricao));
    const ehServico = !ehProduto && !/\(\s*Transporte\s*\)/i.test(String(item.descricao));

    pdf.text(String(item.qtd), colQtd, y);
    pdf.text(descricaoLinhas, colDesc, y);
    if (lay.numDente) pdf.text(String(item.dente).slice(0, 12), colDente, y, { align: "center" });
    if (lay.corDente) pdf.text(String(item.cor).slice(0, 10), colCor, y, { align: "center" });
    if (lay.valorUnit) pdf.text(unitarioTabela(item.unitario), colUnit, y, { align: "right" });
    if (lay.desconto) pdf.text(descontoCelula(item.desconto), colDescPct, y, { align: "right" });
    if (lay.subtotal) {
      pdf.text(unitarioTabela(subtotalItem(item)), tableRight, y, { align: "right" });
    }
    y += Math.max(5, descricaoLinhas.length * 4.5);

    const notasPrazo =
      item.notasAbaixo?.filter(Boolean) ||
      (ehServico &&
      servicoIndex === 0 &&
      data.prazoLinhaServico &&
      !data.itens.some((i) => i.notasAbaixo?.length)
        ? [data.prazoLinhaServico]
        : []);
    if (ehServico) servicoIndex += 1;

    if (lay.dataPrazo && notasPrazo.length) {
      notasPrazo.forEach((nota) => {
        if (y > 265) {
          pdf.addPage();
          y = 16;
        }
        desenharLinhaPrazo(pdf, nota, colDesc, y);
        y += 4.5;
      });
    }

    y += 1.5;
    pdf.line(tableLeft, y, tableRight, y);
    y += 5;
  });

  if (lay.total) {
    y += 3;
    pdf.setFont("helvetica", "bold");
    pdf.text(`TOTAL ${money(data.valor)}`, pageWidth - 15, y, { align: "right" });
    y += 8;
  }

  pdf.setFont("helvetica", "normal");
  const prazosJaNoItem = data.itens.some((item) => item.notasAbaixo?.length);
  if (!prazosJaNoItem && (lay.dataPrazo || lay.finalizado)) {
    const partes: string[] = [];
    if (lay.dataPrazo && data.prazo) partes.push(`Prazo: ${data.prazo}`);
    if (lay.finalizado && data.finalizado) partes.push(`Finalizado: ${data.finalizado}`);
    if (partes.length) {
      pdf.text(partes.join(" | "), 15, y);
      y += 5;
    }
  }
  if (lay.colaborador && data.colaborador) {
    pdf.text(`Colaborador: ${data.colaborador}`, 15, y);
    y += 5;
  }
  if (lay.materialRec && data.materiais) {
    pdf.text(`Materiais: ${data.materiais}`.slice(0, 110), 15, y);
    y += 6;
  }
  if (lay.obsServico && data.observacoes) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Observações / Instruções técnicas:", 15, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    const linhasObservacoes = pdf.splitTextToSize(data.observacoes, 180);
    pdf.text(linhasObservacoes, 15, y);
    y += linhasObservacoes.length * 4 + 3;
  }
  if (lay.etapas && data.etapas) {
    pdf.text(`Etapas: ${data.etapas}`.slice(0, 110), 15, y);
    y += 6;
  }
  if (lay.mensagem?.trim()) {
    const linhasMsg = pdf.splitTextToSize(lay.mensagem.trim(), 180);
    pdf.text(linhasMsg, 15, y);
    y += linhasMsg.length * 4 + 2;
  }
  if (lay.assinatura) {
    y += 12;
    pdf.line(15, y, 80, y);
    pdf.setFontSize(fontBase - 1);
    pdf.text("Assinatura", 15, y + 4);
    y += 10;
  }

  if (lay.codBarras) {
    const barcodeValue = `OS${data.numeroOs}`;
    if (y > 260) {
      pdf.addPage();
      y = 16;
    }
    drawCode39(pdf, barcodeValue, 15, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6);
    pdf.text(barcodeValue, 15, y + 12);
  }

  if (lay.exibirBordas) {
    desenharBordaPaginaPdf(pdf, lay.bordas);
  }
}

function parseQtdItem(qtd: string) {
  return Number(String(qtd).replace(",", ".")) || 1;
}

function parseDescontoPct(desconto: string) {
  const match = (desconto || "").match(/([\d]+[,.]?[\d]*)/);
  if (!match) return 0;
  return Number(match[1].replace(",", ".")) || 0;
}

function valorBrutoItem(item: PdfItem) {
  return item.unitario * parseQtdItem(item.qtd);
}

function subtotalItem(item: PdfItem) {
  const bruto = valorBrutoItem(item);
  const pct = parseDescontoPct(item.desconto);
  return bruto * (1 - pct / 100);
}

function desenharLogoLab(
  pdf: PdfRenderApi,
  lab: LabImpressaoConfig,
  x: number,
  y: number,
  larguraBase = 22,
  alturaBase = 18
): { largura: number; altura: number } {
  const dataUrl = lab.logoDataUrl?.trim();
  if (!dataUrl?.startsWith("data:image")) {
    return { largura: 0, altura: 0 };
  }
  const s = 1 + Math.min(100, Math.max(0, lab.logoTamanho ?? 0)) / 100;
  const w = larguraBase * s;
  const h = alturaBase * s;
  const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
  try {
    pdf.addImage(dataUrl, fmt, x, y, w, h);
    return { largura: w, altura: h };
  } catch {
    return { largura: 0, altura: 0 };
  }
}

/** Modelo 2 — comprovante de entrega (layout Smart/DenteArt). */
function renderModeloComprovante(pdf: PdfRenderApi, data: PdfOsData) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const tableRight = pageWidth - margin;
  let y = desenharCabecalhoRequisicaoPdf(pdf, {
    lab: data.lab,
    cabecalhoRequisicao: data.cabecalhoRequisicao,
    tituloDireita: "Ordem de Serviço",
    extrasDireita: (yDir, _m, dir) => desenharMetaOsCabecalhoDireita(pdf, data, yDir, dir),
  });

  pdf.setFontSize(9);
  labelValue(pdf, "Núm OS:", String(data.numeroOs), margin, y);
  labelValue(pdf, "Caixa:", data.caixa, 110, y, "");
  y += 5;
  labelValue(pdf, "Cliente:", data.cliente, margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.text("Telefones:", 110, y);
  pdf.setFont("helvetica", "bold");
  pdf.text(data.telefones || "", 110 + pdf.getTextWidth("Telefones:") + 1.5, y);
  pdf.setFont("helvetica", "normal");
  y += 5;
  labelValue(pdf, "Dentista:", data.dentista, margin, y);
  pdf.text("Email:", 110, y);
  pdf.setFont("helvetica", "bold");
  pdf.text(data.email || "", 110 + pdf.getTextWidth("Email:") + 1.5, y);
  pdf.setFont("helvetica", "normal");
  y += 5;
  pdf.setFont("helvetica", "bold");
  pdf.text("Paciente:", margin, y);
  pdf.text(data.paciente || "-", margin + pdf.getTextWidth("Paciente:") + 1.5, y);
  pdf.setFont("helvetica", "normal");
  pdf.text("Endereço:", 110, y);
  pdf.setFont("helvetica", "bold");
  const enderecoLinhas = pdf.splitTextToSize(data.endereco || "", 75);
  pdf.text(enderecoLinhas, 110 + pdf.getTextWidth("Endereço:") + 1.5, y);
  y += Math.max(5, enderecoLinhas.length * 4) + 4;

  pdf.line(margin, y, tableRight, y);
  y += 5;

  const colQtd = margin;
  const colDesc = 28;
  const colDente = 100;
  const colCor = 118;
  const colUnit = 148;
  const colDescPct = 168;
  const colSubtotal = tableRight;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Qtd", colQtd, y);
  pdf.text("Descrição", colDesc, y);
  pdf.text("Número Dente", colDente, y, { align: "center" });
  pdf.text("Cor", colCor, y, { align: "center" });
  pdf.text("Unitário", colUnit, y, { align: "right" });
  pdf.text("Desc", colDescPct, y, { align: "right" });
  pdf.text("Subtotal", colSubtotal, y, { align: "right" });
  y += 3;
  pdf.line(margin, y, tableRight, y);
  y += 5;

  pdf.setFont("helvetica", "normal");
  let totalServicos = 0;
  let totalDescontos = 0;

  data.itens.forEach((item) => {
    if (y > 248) {
      pdf.addPage();
      y = 16;
    }
    const bruto = valorBrutoItem(item);
    const subtotal = subtotalItem(item);
    totalServicos += bruto;
    totalDescontos += bruto - subtotal;

    const descricaoLinhas = pdf.splitTextToSize(String(item.descricao), 62);
    pdf.text(String(item.qtd), colQtd, y);
    pdf.text(descricaoLinhas, colDesc, y);
    pdf.text(String(item.dente).slice(0, 10), colDente, y, { align: "center" });
    pdf.text(String(item.cor).slice(0, 8), colCor, y, { align: "center" });
    pdf.text(unitarioTabela(item.unitario), colUnit, y, { align: "right" });
    pdf.text(descontoCelula(item.desconto).replace(".", ","), colDescPct, y, { align: "right" });
    pdf.text(unitarioTabela(subtotal), colSubtotal, y, { align: "right" });
    y += Math.max(5, descricaoLinhas.length * 4.5) + 1.5;
  });

  y += 1;
  pdf.line(margin, y, tableRight, y);
  y += 7;

  const totalFinal = totalServicos - totalDescontos;
  const blocoTotalX = 118;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("TOTAL SERVIÇOS", blocoTotalX, y);
  pdf.text(money(totalServicos), tableRight, y, { align: "right" });
  y += 5;
  pdf.text("(-) DESCONTOS", blocoTotalX, y);
  pdf.text(money(totalDescontos), tableRight, y, { align: "right" });
  y += 5;
  pdf.text("(=) TOTAL", blocoTotalX, y);
  pdf.text(money(totalFinal > 0 ? totalFinal : data.valor), tableRight, y, { align: "right" });
  y += 5;

  pdf.setFont("helvetica", "normal");
  pdf.text("Materiais:", margin, y);
  if (data.materiais) {
    pdf.setFont("helvetica", "bold");
    pdf.text(data.materiais.slice(0, 120), margin + pdf.getTextWidth("Materiais:") + 2, y);
    pdf.setFont("helvetica", "normal");
  }
  y += 6;

  const assinaturaLargura = 90;
  const assinaturaX = (pageWidth - assinaturaLargura) / 2;
  const assinaturaY = y + 2;
  pdf.line(assinaturaX, assinaturaY, assinaturaX + assinaturaLargura, assinaturaY);
  pdf.setFontSize(8);
  pdf.text("Recebi o(s) serviço(s) descritos acima", pageWidth / 2, assinaturaY + 3.5, {
    align: "center",
  });

  const barcodeValue = `OS${data.numeroOs}`;
  const barcodeY = assinaturaY + 8;
  drawCode39(pdf, barcodeValue, margin, barcodeY);
  pdf.setFontSize(6);
  pdf.text(barcodeValue, margin, barcodeY + 10);

  pdf.setLineWidth(0.4);
  pdf.line(margin, barcodeY + 14, tableRight, barcodeY + 14);
}

const TERMICA_MARGEM = 4;

function linhaTermica(pdf: PdfRenderApi, y: number, pageWidth: number) {
  pdf.setLineWidth(0.25);
  pdf.line(TERMICA_MARGEM, y, pageWidth - TERMICA_MARGEM, y);
}

function campoTermica(
  pdf: PdfRenderApi,
  label: string,
  valor: string,
  x: number,
  y: number,
  larguraValor: number
) {
  pdf.setFont("helvetica", "normal");
  pdf.text(label, x, y);
  const vx = x + pdf.getTextWidth(label) + 1;
  pdf.setFont("helvetica", "bold");
  const linhas = pdf.splitTextToSize(valor || "", larguraValor);
  pdf.text(linhas, vx, y);
  return y + Math.max(3.8, linhas.length * 3.6);
}

function prazoDoItemTermica(item: PdfItem, data: PdfOsData) {
  const nota = item.notasAbaixo?.find((n) => /prazo/i.test(n));
  if (nota) {
    const dataMatch = nota.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dataMatch) return dataMatch[1];
  }
  const candidatos = [data.prazo, data.prazoLaboratorio, data.prazoDentista, data.dataEntrada];
  for (const c of candidatos) {
    const m = (c || "").match(/\d{2}\/\d{2}\/\d{4}/);
    if (m) return m[0];
  }
  return "";
}

/** Modelo 3 — comprovante térmico 80mm (Epson T20). */
function renderTermicaModelo3(pdf: PdfRenderApi, data: PdfOsData): number {
  const lab = data.lab || LAB_IMPRESSAO_PADRAO;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const cx = pageWidth / 2;
  const mx = TERMICA_MARGEM;
  const larguraTexto = pageWidth - mx * 2;
  let y = 5;

  const logoTermica = desenharLogoLab(pdf, lab, cx - 14, y, 28, 12);
  if (logoTermica.altura > 0) y += logoTermica.altura + 3;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(lab.responsavel, cx, y, { align: "center" });
  y += 6;

  linhaTermica(pdf, y, pageWidth);
  y += 4;

  pdf.setFontSize(8);
  y = campoTermica(pdf, "OS:", String(data.numeroOs), mx, y, larguraTexto - 10);
  y = campoTermica(pdf, "Conta:", data.caixa, mx, y, larguraTexto - 14);
  y = campoTermica(pdf, "Cliente:", data.cliente, mx, y, larguraTexto - 18);
  y = campoTermica(pdf, "Dentista:", data.dentista, mx, y, larguraTexto - 18);
  y = campoTermica(pdf, "Paciente:", data.paciente, mx, y, larguraTexto - 18);
  y += 1;

  linhaTermica(pdf, y, pageWidth);
  y += 4;

  pdf.setFont("helvetica", "bold");
  pdf.text("Qtd", mx, y);
  pdf.text("Descrição", mx + 10, y);
  y += 4;
  linhaTermica(pdf, y, pageWidth);
  y += 4;

  pdf.setFont("helvetica", "normal");
  for (const item of data.itens) {
    const descricaoLinhas = pdf.splitTextToSize(String(item.descricao), larguraTexto - 12);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(item.qtd), mx, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(descricaoLinhas, mx + 10, y);
    y += Math.max(4, descricaoLinhas.length * 3.5) + 1;

    pdf.setFontSize(7.5);
    y = campoTermica(pdf, "Num Dente:", item.dente, mx + 2, y, larguraTexto - 22);
    y = campoTermica(pdf, "Cor Dente:", item.cor, mx + 2, y, larguraTexto - 22);
    const prazo = prazoDoItemTermica(item, data);
    y = campoTermica(pdf, "Prazo:", prazo, mx + 2, y, larguraTexto - 14);
    pdf.setFontSize(8);
    y += 1;
  }

  linhaTermica(pdf, y, pageWidth);
  y += 4;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(lab.enderecoLinha1, cx, y, { align: "center" });
  y += 3.5;
  pdf.text(lab.enderecoLinha2, cx, y, { align: "center" });
  y += 3.5;
  pdf.text(lab.telefones, cx, y, { align: "center" });
  y += 3.5;
  pdf.text(lab.email, cx, y, { align: "center" });
  y += 5;

  const barcodeValue = `OS${data.numeroOs}`;
  const barcodeW = 42;
  drawCode39(pdf, barcodeValue, cx - barcodeW / 2, y);
  pdf.setFontSize(6);
  pdf.text(barcodeValue, cx, y + 10, { align: "center" });
  y += 13;
  linhaTermica(pdf, y, pageWidth);

  return y + 2;
}

function descTermicaPct(desconto: string) {
  const pct = parseDescontoPct(desconto);
  if (pct > 0) return `${pct.toFixed(2).replace(".", ",")}%`;
  const texto = (desconto || "").trim().replace(".", ",");
  if (texto.includes("%")) return texto;
  return "0,00%";
}

function totalTermicaDireita(
  pdf: PdfRenderApi,
  texto: string,
  y: number,
  pageWidth: number,
  mx: number
) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text(texto, pageWidth - mx, y, { align: "right" });
  return y + 4;
}

/** Modelo 4 — comprovante com valores/descontos (térmica 80mm, Epson T20). */
function renderTermicaModelo4(pdf: PdfRenderApi, data: PdfOsData): number {
  const lab = data.lab || LAB_IMPRESSAO_PADRAO;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const cx = pageWidth / 2;
  const mx = TERMICA_MARGEM;
  const dir = pageWidth - mx;
  const larguraDesc = 38;
  let y = 5;

  const logoTermica = desenharLogoLab(pdf, lab, cx - 14, y, 28, 12);
  if (logoTermica.altura > 0) y += logoTermica.altura + 3;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(lab.responsavel, cx, y, { align: "center" });
  y += 6;

  linhaTermica(pdf, y, pageWidth);
  y += 4;

  pdf.setFontSize(7.5);
  const larguraCampo = pageWidth - mx * 2 - 22;
  y = campoTermica(pdf, "OS:", String(data.numeroOs), mx, y, larguraCampo);
  y = campoTermica(pdf, "Conta:", data.caixa, mx, y, larguraCampo);
  y = campoTermica(pdf, "Cliente:", data.cliente, mx, y, larguraCampo);
  y = campoTermica(pdf, "Dentista:", data.dentista, mx, y, larguraCampo);
  y = campoTermica(pdf, "Paciente:", data.paciente, mx, y, larguraCampo);
  y = campoTermica(pdf, "Telefone:", data.telefones, mx, y, larguraCampo);
  y = campoTermica(pdf, "Email:", data.email, mx, y, larguraCampo);
  y = campoTermica(pdf, "Endereço:", data.endereco, mx, y, larguraCampo);
  y += 1;

  linhaTermica(pdf, y, pageWidth);
  y += 4;

  const colQtd = mx;
  const colDesc = mx + 9;
  const colValorUn = 54;
  const colDescPct = dir;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("Qtd", colQtd, y);
  pdf.text("Descrição", colDesc, y);
  pdf.text("Valor Un", colValorUn, y, { align: "right" });
  pdf.text("Desc", colDescPct, y, { align: "right" });
  y += 3.5;
  linhaTermica(pdf, y, pageWidth);
  y += 4;

  pdf.setFont("helvetica", "normal");
  let totalServicos = 0;
  let totalDescontos = 0;

  for (const item of data.itens) {
    const bruto = valorBrutoItem(item);
    const subtotal = subtotalItem(item);
    totalServicos += bruto;
    totalDescontos += bruto - subtotal;

    const descricaoLinhas = pdf.splitTextToSize(String(item.descricao), larguraDesc);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text(String(item.qtd), colQtd, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(descricaoLinhas, colDesc, y);
    pdf.text(unitarioTabela(item.unitario), colValorUn, y, { align: "right" });
    pdf.text(descTermicaPct(item.desconto), colDescPct, y, { align: "right" });
    y += Math.max(4, descricaoLinhas.length * 3.4) + 1;

    pdf.setFontSize(7);
    y = campoTermica(pdf, "Num Dente:", item.dente, mx + 1, y, larguraCampo);
    y = campoTermica(pdf, "Cor Dente:", item.cor, mx + 1, y, larguraCampo);
    y += 1;
  }

  linhaTermica(pdf, y, pageWidth);
  y += 4;

  const subtotalGeral = totalServicos - totalDescontos;
  y = totalTermicaDireita(pdf, `Subtotal: ${money(subtotalGeral)}`, y, pageWidth, mx);
  y = totalTermicaDireita(pdf, `Total Serviços: ${money(totalServicos)}`, y, pageWidth, mx);
  y = totalTermicaDireita(pdf, `(-) Descontos: ${money(totalDescontos)}`, y, pageWidth, mx);
  y = totalTermicaDireita(pdf, `(=) Total: ${money(subtotalGeral > 0 ? subtotalGeral : data.valor)}`, y, pageWidth, mx);
  y += 2;

  linhaTermica(pdf, y, pageWidth);
  y += 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("Recebi o(s) serviço(s) descritos acima.", cx, y, { align: "center" });
  y += 5;
  pdf.text(lab.enderecoLinha1, cx, y, { align: "center" });
  y += 3.5;
  pdf.text(lab.enderecoLinha2.replace(" / ", "/"), cx, y, { align: "center" });
  y += 3.5;
  pdf.text(lab.telefones, cx, y, { align: "center" });
  y += 3.5;
  pdf.text(`Email: ${lab.email}`, cx, y, { align: "center" });
  y += 5;

  const barcodeValue = `OS${data.numeroOs}`;
  const barcodeW = 42;
  drawCode39(pdf, barcodeValue, cx - barcodeW / 2, y);
  pdf.setFontSize(6);
  pdf.text(barcodeValue, cx, y + 10, { align: "center" });
  y += 13;
  linhaTermica(pdf, y, pageWidth);

  return y + 2;
}

function renderTermicaPorModelo(modelo: string) {
  if (modelo === "modelo4" || modelo === "modelo5") return renderTermicaModelo4;
  return renderTermicaModelo3;
}

export function PdfOsViewer({
  data,
  formato = "a4",
  modelo = "modelo1",
  duasVias = false,
}: {
  data: PdfOsData;
  formato?: string;
  modelo?: string;
  duasVias?: boolean;
}) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [erroPdf, setErroPdf] = useState("");
  const [dadosPdf, setDadosPdf] = useState<PdfOsData>(() => ({
    ...data,
    lab: data.lab || LAB_IMPRESSAO_PADRAO,
  }));

  function atualizarLab() {
    const cfg = carregarConfigLaboratorio();
    setDadosPdf({
      ...data,
      lab: labImpressaoFromConfig(),
      cabecalhoRequisicao: normalizarCabecalhoRequisicao(cfg.cabecalhoRequisicao),
      layoutModelo1: carregarLayoutModelo1(),
    });
  }

  useEffect(() => {
    atualizarLab();
  }, [data]);

  useEffect(() => {
    const handler = () => atualizarLab();
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, handler);
    window.addEventListener(CONFIG_OS_ATUALIZADA_EVENT, handler);
    return () => {
      window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, handler);
      window.removeEventListener(CONFIG_OS_ATUALIZADA_EVENT, handler);
    };
  }, [data]);

  useEffect(() => {
    let url = "";

    async function buildPdf() {
      setErroPdf("");
      const { jsPDF } = await import("jspdf");

      if (formato === "termica") {
        const renderTermica = renderTermicaPorModelo(modelo);
        const medida = new jsPDF({ unit: "mm", format: [80, 400] });
        const finalY = renderTermica(medida as unknown as PdfRenderApi, dadosPdf);
        const altura = Math.min(Math.max(Math.ceil(finalY + 4), 58), 400);

        const pdf = new jsPDF({ unit: "mm", format: [80, altura] });
        const api = pdf as unknown as PdfRenderApi;
        renderTermica(api, dadosPdf);
        if (duasVias) {
          pdf.addPage([80, altura]);
          renderTermica(api, dadosPdf);
        }
        const blob = pdf.output("blob");
        url = URL.createObjectURL(blob);
        setPdfUrl(url);
        return;
      }

      const usarComprovante = formato === "a4" && modelo === "modelo2";
      const pdf = new jsPDF({ unit: "mm", format: criarPdf(formato) });
      const api = pdf as unknown as PdfRenderApi;
      const renderPagina = () =>
        usarComprovante
          ? renderModeloComprovante(api, dadosPdf)
          : renderModeloProducao(api, dadosPdf);

      renderPagina();
      if (duasVias) {
        pdf.addPage();
        renderPagina();
      }

      const blob = pdf.output("blob");
      url = URL.createObjectURL(blob);
      setPdfUrl(url);
    }

    void buildPdf().catch((err) => {
      console.error("gerar PDF OS", err);
      setErroPdf(
        err instanceof Error
          ? err.message
          : "Não foi possível gerar o PDF da requisição."
      );
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [dadosPdf, formato, modelo, duasVias]);

  function imprimirPdf() {
    if (!pdfUrl) return;
    const iframe = document.getElementById("pdf-os-viewer") as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.print();
    } catch {
      /* ignorar */
    }
  }

  function abrirEmNovaAba() {
    if (!pdfUrl) return;
    const janela = prepararAbaPdf();
    visualizarPdfUrl(pdfUrl, `OS-${data.numeroOs}.pdf`, `OS ${data.numeroOs}`, {
      janela,
      revogarAoFechar: false,
    });
  }

  return (
    <div className="flex h-screen flex-col bg-[#525659]">
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h1 className="text-sm font-semibold">OS {data.numeroOs} — PDF</h1>
          <p className="text-xs text-slate-300">
            {formato === "termica" && modelo === "modelo3"
              ? "Comprovante — Térmica 80mm (Modelo 3)"
              : formato === "termica" && modelo === "modelo4"
                ? "Comprovante de entrega — Térmica 80mm (Modelo 4)"
                : formato === "a4" && modelo === "modelo2"
                  ? "Comprovante de entrega (A4)"
                  : "Ordem de Serviço"}
          </p>
        </div>
        <div className="flex gap-2">
          {pdfUrl && (
            <>
              <a href={pdfUrl} download={`OS-${data.numeroOs}.pdf`}>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 border-slate-500 bg-transparent text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar
                </Button>
              </a>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={imprimirPdf}
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={abrirEmNovaAba}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Nova aba
              </Button>
            </>
          )}
        </div>
      </div>
      {erroPdf ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-sm font-medium text-red-300">{erroPdf}</p>
          <Button type="button" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      ) : pdfUrl ? (
        <iframe
          id="pdf-os-viewer"
          title={`OS ${data.numeroOs}`}
          src={pdfUrl}
          className="h-full w-full flex-1 border-0"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
          Gerando PDF da OS...
        </div>
      )}
    </div>
  );
}
