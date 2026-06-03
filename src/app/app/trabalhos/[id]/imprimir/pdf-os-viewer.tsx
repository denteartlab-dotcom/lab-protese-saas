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
import {
  CONFIG_OS_ATUALIZADA_EVENT,
  carregarLayoutModelo1,
  carregarLayoutModelo2,
  carregarLayoutModelo3,
  carregarLayoutModelo4,
  carregarLayoutModelo5,
  sincronizarConfiguracoesOsDoServidor,
} from "@/lib/configuracoes-os";
import {
  hexParaRgb,
  normalizarOsModelo1Layout,
  escalaEspacamentoRequisicao,
  gapRequisicaoMm,
  margensLinhaRequisicao,
  OS_MODELO1_BORDA_MARGEM_MM,
  OS_REQUISICAO_BORDA_EXTERNA_MM,
  OS_REQUISICAO_BORDA_PADDING_MM,
  OS_REQUISICAO_LINHA_DIVISAO_COR,
  OS_REQUISICAO_LINHA_INTERNA_MM,
  OS_ASSINATURA_LINHA_COMPROVANTE_MM,
  OS_ASSINATURA_LINHA_PRODUCAO_MM,
  OS_REQUISICAO_COL_DESCRICAO_MM,
  OS_REQUISICAO_MARGEM_CONTEUDO_MM,
  OS_REQUISICAO_TOPO_MM,
  type OsModelo1Layout,
} from "@/lib/os-modelo1-layout";
import { normalizarOsModelo2Layout } from "@/lib/os-modelo2-layout";
import { normalizarOsModelo3Layout } from "@/lib/os-modelo3-layout";
import { normalizarOsModelo4Layout, type OsModelo4Layout } from "@/lib/os-modelo4-layout";
import { normalizarOsModelo5Layout, type OsModelo5Layout } from "@/lib/os-modelo5-layout";
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
  obsFicha?: string;
  /** Linha de prazo abaixo do serviço (garantia se notasAbaixo não vier no item). */
  prazoLinhaServico?: string;
  layoutModelo1?: OsModelo1Layout;
  layoutModelo2?: OsModelo1Layout;
  layoutModelo3?: OsModelo1Layout;
  layoutModelo4?: OsModelo4Layout;
  layoutModelo5?: OsModelo5Layout;
  chavePed?: string;
  osExterna?: string;
  finalizado?: string;
  colaborador?: string;
  etapas?: string;
  producao?: string;
  pecas?: string;
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

function textoPrazoRequisicao(data: PdfOsData) {
  const direto = (data.prazo || data.prazoLaboratorio || "").trim();
  if (direto) return direto;
  const nota = data.itens.find((i) => i.notasAbaixo?.length)?.notasAbaixo?.[0] || data.prazoLinhaServico || "";
  const match = nota.match(/Prazo:\s*(?:[^:]+:\s*)?(.+)$/i);
  return match?.[1]?.trim() || "";
}

/** Prazo e Finalizado na mesma linha, como no preview da configuração. */
function desenharPrazoFinalizadoRequisicao(
  pdf: PdfRenderApi,
  lay: OsModelo1Layout,
  data: PdfOsData,
  x: number,
  y: number
) {
  const prazo = textoPrazoRequisicao(data);
  const finalizado = (data.finalizado || "").trim();
  let cursor = x;
  pdf.setFont("helvetica", "normal");

  if (lay.dataPrazo) {
    pdf.text("Prazo: ", cursor, y);
    cursor += pdf.getTextWidth("Prazo: ");
    pdf.setFont("helvetica", "bold");
    pdf.text(prazo || "—", cursor, y);
    cursor += pdf.getTextWidth(prazo || "—") + 1.5;
    pdf.setFont("helvetica", "normal");
  }

  if (lay.dataPrazo && lay.finalizado) {
    pdf.text("|", cursor, y);
    cursor += pdf.getTextWidth("|") + 1.5;
  }

  if (lay.finalizado) {
    pdf.text("Finalizado: ", cursor, y);
    cursor += pdf.getTextWidth("Finalizado: ");
    pdf.setFont("helvetica", "bold");
    pdf.text(finalizado || "—", cursor, y);
    pdf.setFont("helvetica", "normal");
  }
}

function desenharMetadadosServicoRequisicao(
  pdf: PdfRenderApi,
  lay: OsModelo1Layout,
  data: PdfOsData,
  colDesc: number,
  yInicio: number,
  g: (mm: number) => number
) {
  let y = yInicio;
  const mostraPrazo = lay.dataPrazo || lay.finalizado;
  const mostraColab = lay.colaborador;
  const mostraProd = lay.producao && Boolean(data.producao?.trim());
  const mostraObs = lay.obsServico;

  if (!mostraPrazo && !mostraColab && !mostraProd && !mostraObs) {
    return y;
  }

  if (mostraPrazo) {
    desenharPrazoFinalizadoRequisicao(pdf, lay, data, colDesc, y);
    y += g(4);
  }
  if (mostraColab) {
    labelValue(pdf, "Colaborador: ", data.colaborador || "", colDesc, y);
    y += g(4);
  }
  if (mostraProd) {
    labelValue(pdf, "Produção: ", data.producao || "", colDesc, y);
    y += g(4);
  }
  if (mostraObs) {
    const texto = (data.observacoes || "").trim();
    const linhasObs = pdf.splitTextToSize(texto || "—", 182 - colDesc);
    labelValue(pdf, "Observação: ", linhasObs[0] || "", colDesc, y);
    y += g(4);
    if (linhasObs.length > 1) {
      pdf.setFont("helvetica", "normal");
      pdf.text(linhasObs.slice(1), colDesc, y);
      y += (linhasObs.length - 1) * 3.8 * escalaEspacamentoRequisicao(lay) + g(2);
    }
  }
  return y;
}

type VarianteRodapeRequisicao = "producao" | "comprovante";

/** Rodapé A4 igual ao preview: assinatura centralizada e código de barras à esquerda. */
function desenharRodapeRequisicaoA4(
  pdf: PdfRenderApi,
  lay: OsModelo1Layout,
  data: PdfOsData,
  pageWidth: number,
  conteudoEsq: number,
  yInicio: number,
  g: (mm: number) => number,
  fontBase: number,
  variante: VarianteRodapeRequisicao,
  linhaSegmento: (
    pdf: PdfRenderApi,
    lay: OsModelo1Layout,
    x1: number,
    y: number,
    x2: number
  ) => void,
  linhaPagina: (pdf: PdfRenderApi, lay: OsModelo1Layout, y: number, pageWidth: number) => void
) {
  let y = yInicio;

  if (lay.assinatura) {
    y += g(6);
    const largura =
      variante === "comprovante"
        ? OS_ASSINATURA_LINHA_COMPROVANTE_MM
        : OS_ASSINATURA_LINHA_PRODUCAO_MM;
    const xLinha = (pageWidth - largura) / 2;
    linhaSegmento(pdf, lay, xLinha, y, xLinha + largura);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontBase - 1);
    const rotuloAssinatura =
      variante === "comprovante"
        ? "Recebi o(s) serviço(s) descritos acima"
        : "Assinatura";
    pdf.text(rotuloAssinatura, pageWidth / 2, y + 4, { align: "center" });
    y += g(6);
  }

  if (lay.codBarras) {
    if (!lay.assinatura) {
      y += g(4);
    }
    const barcodeValue = `OS${data.numeroOs}`;
    drawCode39(pdf, barcodeValue, conteudoEsq, y);
    y += 10;
    linhaPagina(pdf, lay, y, pageWidth);
  }

  return y;
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

function yTopoBordaRequisicaoPdf() {
  return OS_REQUISICAO_TOPO_MM - OS_REQUISICAO_BORDA_PADDING_MM;
}

function desenharBordaRequisicaoPdf(
  pdf: PdfRenderApi,
  corHex: string,
  yFimConteudo: number
) {
  const { r, g, b } = hexParaRgb(corHex);
  const pw = pdf.internal.pageSize.getWidth();
  const m = OS_MODELO1_BORDA_MARGEM_MM;
  const yTop = yTopoBordaRequisicaoPdf();
  const yBottom = yFimConteudo + OS_REQUISICAO_BORDA_PADDING_MM;
  const t = OS_REQUISICAO_BORDA_EXTERNA_MM;
  const w = pw - m * 2;
  const h = Math.max(t, yBottom - yTop);
  pdf.setFillColor(r, g, b);
  pdf.rect(m, yTop, w, t, "F");
  pdf.rect(m, yBottom - t, w, t, "F");
  pdf.rect(m, yTop, t, h, "F");
  pdf.rect(pw - m - t, yTop, t, h, "F");
}

/** Linha divisória preenchida (espessura fixa, igual ao preview 1px). */
function linhaRequisicaoPdf(
  pdf: PdfRenderApi,
  lay: OsModelo1Layout,
  y: number,
  pageWidth: number
) {
  const { linhaEsq, linhaDir } = margensLinhaRequisicao(pageWidth);
  const h = OS_REQUISICAO_LINHA_INTERNA_MM;
  const { r, g, b } = hexParaRgb(OS_REQUISICAO_LINHA_DIVISAO_COR);
  pdf.setFillColor(r, g, b);
  pdf.rect(linhaEsq, y - h / 2, linhaDir - linhaEsq, h, "F");
}

function linhaRequisicaoPdfSegmento(
  pdf: PdfRenderApi,
  _lay: OsModelo1Layout,
  x1: number,
  y: number,
  x2: number
) {
  const h = OS_REQUISICAO_LINHA_INTERNA_MM;
  const { r, g, b } = hexParaRgb(OS_REQUISICAO_LINHA_DIVISAO_COR);
  pdf.setFillColor(r, g, b);
  pdf.rect(x1, y - h / 2, x2 - x1, h, "F");
}

function renderModeloProducao(
  pdf: PdfRenderApi,
  data: PdfOsData,
  layoutOverride?: OsModelo1Layout
) {
  const lay = normalizarOsModelo1Layout(layoutOverride ?? data.layoutModelo1);
  const fontBase = Math.max(7, lay.tamanhoFonte * 0.53);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const m = margensLinhaRequisicao(pageWidth);
  const g = (mm: number) => gapRequisicaoMm(lay, mm);
  const colDir = 110;
  let y = desenharCabecalhoRequisicaoPdf(pdf, {
    lab: data.lab,
    cabecalhoRequisicao: data.cabecalhoRequisicao,
    tituloDireita: "Ordem de Serviço",
    exibirLogo: lay.logo,
    exibirInfoLab: lay.infoLab,
    linhaEsq: m.linhaEsq,
    linhaDir: m.linhaDir,
    extrasDireita: (yDir, _marg, dir) =>
      desenharMetaOsCabecalhoDireita(pdf, data, yDir, dir, lay),
  });

  pdf.setFontSize(fontBase);
  if (lay.numOs) {
    labelValue(pdf, "Núm OS:", String(data.numeroOs), m.conteudoEsq, y);
  }
  if (lay.osExterna) {
    pdf.setFont("helvetica", "normal");
    pdf.text("OS Externa:", colDir, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(data.osExterna || "—", colDir + pdf.getTextWidth("OS Externa:") + 1.5, y);
    pdf.setFont("helvetica", "normal");
  }
  if (lay.numOs || lay.osExterna) {
    desenharMarcadoresUrgenciaRepeticao(pdf, data, colDir, y);
    y += g(4);
  }
  if (lay.cliente) {
    labelValue(pdf, "Cliente:", data.cliente, m.conteudoEsq, y);
  }
  if (lay.caixa) {
    labelValue(pdf, "Caixa:", data.caixa, colDir, y, "");
  }
  if (lay.cliente || lay.caixa) y += g(4);
  if (lay.dentista) {
    labelValue(pdf, "Dentista:", data.dentista, m.conteudoEsq, y);
  }
  if (lay.clienteTel) {
    pdf.text(`Telefones: ${data.telefones}`, colDir, y);
  }
  if (lay.dentista || lay.clienteTel) y += g(4);
  if (lay.paciente) {
    labelValue(pdf, "Paciente:", data.paciente, m.conteudoEsq, y);
  }
  if (lay.clienteEnd) {
    pdf.text(`Endereço: ${data.endereco}`, colDir, y);
  }
  if (lay.paciente || lay.clienteEnd) y += g(4);
  if (lay.clienteEmail) {
    pdf.text(`Email: ${data.email}`, lay.clienteTel ? m.conteudoEsq : colDir, y);
    y += g(4);
  }

  y += g(2);
  linhaRequisicaoPdf(pdf, lay, y, pageWidth);
  y += g(4);

  const colQtd = m.tabelaEsq;
  const colDesc = 28;
  let colDente = 112;
  let colCor = 132;
  let colUnit = 158;
  let colDescPct = m.tabelaDir;
  const colSubtotalDir = m.tabelaDir;
  if (lay.subtotal) {
    colDescPct = m.tabelaDir - 22;
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
  if (lay.subtotal) pdf.text("Subtotal", colSubtotalDir, y, { align: "right" });
  y += g(2);
  linhaRequisicaoPdf(pdf, lay, y, pageWidth);
  y += g(4);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontBase);
  const totalItens = data.itens.length;
  data.itens.forEach((item, indiceItem) => {
    if (y > 265) {
      pdf.addPage();
      y = OS_REQUISICAO_MARGEM_CONTEUDO_MM + 1;
    }
    const descricaoLinhas = pdf.splitTextToSize(String(item.descricao), lay.subtotal ? 58 : 68);

    pdf.text(String(item.qtd), colQtd, y);
    pdf.text(descricaoLinhas, colDesc, y);
    if (lay.numDente) pdf.text(String(item.dente).slice(0, 12), colDente, y, { align: "center" });
    if (lay.corDente) pdf.text(String(item.cor).slice(0, 10), colCor, y, { align: "center" });
    if (lay.valorUnit) pdf.text(unitarioTabela(item.unitario), colUnit, y, { align: "right" });
    if (lay.desconto) pdf.text(descontoCelula(item.desconto), colDescPct, y, { align: "right" });
    if (lay.subtotal) {
      pdf.text(unitarioTabela(subtotalItem(item)), colSubtotalDir, y, { align: "right" });
    }
    y += Math.max(g(4), descricaoLinhas.length * 4.2 * escalaEspacamentoRequisicao(lay));

    if (indiceItem < totalItens - 1) {
      y += g(1);
      linhaRequisicaoPdf(pdf, lay, y, pageWidth);
      y += g(4);
    } else {
      y += g(1);
    }
  });

  y = desenharMetadadosServicoRequisicao(pdf, lay, data, colDesc, y, g);

  if (lay.total) {
    linhaRequisicaoPdf(pdf, lay, y, pageWidth);
    y += g(3);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total ${money(data.valor)}`, m.tabelaDir, y, { align: "right" });
    y += g(6);
  } else {
    linhaRequisicaoPdf(pdf, lay, y, pageWidth);
    y += g(4);
  }

  pdf.setFont("helvetica", "normal");
  if (lay.materialRec && data.materiais) {
    labelValue(pdf, "Materiais: ", data.materiais.slice(0, 110), m.conteudoEsq, y);
    y += g(5);
  }
  if (lay.obsFicha && data.obsFicha) {
    labelValue(pdf, "Observação: ", data.obsFicha.slice(0, 110), m.conteudoEsq, y);
    y += g(5);
  }
  if (lay.etapas && data.etapas) {
    labelValue(pdf, "Etapas: ", data.etapas.slice(0, 110), m.conteudoEsq, y);
    y += g(5);
  }
  if (lay.pecas && data.pecas) {
    labelValue(pdf, "Peças: ", data.pecas.slice(0, 110), m.conteudoEsq, y);
    y += g(5);
  }
  if (lay.mensagem?.trim()) {
    const linhasMsg = pdf.splitTextToSize(lay.mensagem.trim(), 180);
    pdf.text(linhasMsg, m.conteudoEsq, y);
    y += linhasMsg.length * 3.8 * escalaEspacamentoRequisicao(lay) + g(2);
  }

  y = desenharRodapeRequisicaoA4(
    pdf,
    lay,
    data,
    pageWidth,
    m.conteudoEsq,
    y,
    g,
    fontBase,
    "producao",
    linhaRequisicaoPdfSegmento,
    linhaRequisicaoPdf
  );

  if (lay.exibirBordas) {
    desenharBordaRequisicaoPdf(pdf, lay.bordas, y);
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

/** Modelo 3 — comprovante de entrega A4 (layout Smart/DenteArt). */
function renderModeloComprovante(
  pdf: PdfRenderApi,
  data: PdfOsData,
  layoutOverride?: OsModelo1Layout
) {
  const lay = normalizarOsModelo3Layout(layoutOverride ?? data.layoutModelo3);
  const fontBase = Math.max(7, lay.tamanhoFonte * 0.53);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const m = margensLinhaRequisicao(pageWidth);
  const g = (mm: number) => gapRequisicaoMm(lay, mm);
  const colDir = 110;
  let y = desenharCabecalhoRequisicaoPdf(pdf, {
    lab: data.lab,
    cabecalhoRequisicao: data.cabecalhoRequisicao,
    tituloDireita: "Ordem de Serviço",
    exibirLogo: lay.logo,
    exibirInfoLab: lay.infoLab,
    linhaEsq: m.linhaEsq,
    linhaDir: m.linhaDir,
    extrasDireita: (yDir, _marg, dir) => desenharMetaOsCabecalhoDireita(pdf, data, yDir, dir, lay),
  });

  pdf.setFontSize(fontBase);

  if (lay.numOs) {
    labelValue(pdf, "Núm OS:", String(data.numeroOs), m.conteudoEsq, y);
  }
  if (lay.osExterna) {
    pdf.setFont("helvetica", "normal");
    pdf.text("OS Externa:", colDir, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(data.osExterna || "—", colDir + pdf.getTextWidth("OS Externa:") + 1.5, y);
    pdf.setFont("helvetica", "normal");
  }
  if (lay.numOs || lay.osExterna) y += g(4);

  if (lay.cliente) {
    labelValue(pdf, "Cliente:", data.cliente, m.conteudoEsq, y);
  }
  if (lay.caixa) {
    labelValue(pdf, "Caixa:", data.caixa, colDir, y, "");
  }
  if (lay.cliente || lay.caixa) y += g(4);

  if (lay.dentista) {
    labelValue(pdf, "Dentista:", data.dentista, m.conteudoEsq, y);
  }
  if (lay.clienteTel) {
    pdf.text(`Telefones: ${data.telefones}`, colDir, y);
  }
  if (lay.dentista || lay.clienteTel) y += g(4);

  if (lay.paciente) {
    labelValue(pdf, "Paciente:", data.paciente, m.conteudoEsq, y);
  }
  if (lay.clienteEmail) {
    pdf.setFont("helvetica", "normal");
    pdf.text("Email:", colDir, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(data.email || "", colDir + pdf.getTextWidth("Email:") + 1.5, y);
    pdf.setFont("helvetica", "normal");
  }
  if (lay.paciente || lay.clienteEmail) y += g(4);

  if (lay.clienteEnd) {
    pdf.text(`Endereço: ${data.endereco}`, colDir, y);
    y += g(4);
  }

  y += g(2);
  linhaRequisicaoPdf(pdf, lay, y, pageWidth);
  y += g(4);

  const colQtd = m.tabelaEsq;
  const colDesc = OS_REQUISICAO_COL_DESCRICAO_MM;
  let colDente = 100;
  let colCor = 118;
  let colUnit = 148;
  let colDescPct = 168;
  let colSubtotal = m.tabelaDir;
  if (lay.subtotal) {
    colDescPct = m.tabelaDir - 22;
    colUnit = colDescPct - 26;
    colCor = colUnit - 26;
    colDente = colCor - 20;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fontBase + 1);
  pdf.text("Qtd", colQtd, y);
  pdf.text("Descrição", colDesc, y);
  if (lay.numDente) pdf.text("Número Dente", colDente, y, { align: "center" });
  if (lay.corDente) pdf.text("Cor", colCor, y, { align: "center" });
  if (lay.valorUnit) pdf.text("Unitário", colUnit, y, { align: "right" });
  if (lay.desconto) pdf.text("Desc", colDescPct, y, { align: "right" });
  if (lay.subtotal) pdf.text("Subtotal", colSubtotal, y, { align: "right" });
  y += g(2);
  linhaRequisicaoPdf(pdf, lay, y, pageWidth);
  y += g(4);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontBase);
  let totalServicos = 0;
  let totalDescontos = 0;

  data.itens.forEach((item) => {
    if (y > 248) {
      pdf.addPage();
      y = OS_REQUISICAO_MARGEM_CONTEUDO_MM + 1;
    }
    const bruto = valorBrutoItem(item);
    const subtotal = subtotalItem(item);
    totalServicos += bruto;
    totalDescontos += bruto - subtotal;

    const descricaoLargura = lay.subtotal ? 62 : 72;
    const descricaoLinhas = pdf.splitTextToSize(String(item.descricao), descricaoLargura);
    pdf.text(String(item.qtd), colQtd, y);
    pdf.text(descricaoLinhas, colDesc, y);
    if (lay.numDente) pdf.text(String(item.dente).slice(0, 12), colDente, y, { align: "center" });
    if (lay.corDente) pdf.text(String(item.cor).slice(0, 10), colCor, y, { align: "center" });
    if (lay.valorUnit) pdf.text(unitarioTabela(item.unitario), colUnit, y, { align: "right" });
    if (lay.desconto) {
      pdf.text(descontoCelula(item.desconto).replace(".", ","), colDescPct, y, { align: "right" });
    }
    if (lay.subtotal) {
      pdf.text(unitarioTabela(subtotal), colSubtotal, y, { align: "right" });
    }
    y += Math.max(g(4), descricaoLinhas.length * 4.2 * escalaEspacamentoRequisicao(lay));
    y += g(1);
  });

  y = desenharMetadadosServicoRequisicao(pdf, lay, data, colDesc, y, g);

  y += g(1);
  linhaRequisicaoPdf(pdf, lay, y, pageWidth);
  y += g(5);

  const totalFinal = totalServicos - totalDescontos;
  if (lay.total) {
    const blocoTotalX = 118;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(fontBase + 1);
    pdf.text("TOTAL SERVIÇOS", blocoTotalX, y);
    pdf.text(money(totalServicos), m.tabelaDir, y, { align: "right" });
    y += g(4);
    pdf.text("(-) DESCONTOS", blocoTotalX, y);
    pdf.text(money(totalDescontos), m.tabelaDir, y, { align: "right" });
    y += g(4);
    pdf.text("(=) TOTAL", blocoTotalX, y);
    pdf.text(money(totalFinal > 0 ? totalFinal : data.valor), m.tabelaDir, y, { align: "right" });
    y += g(4);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontBase);
  }

  if (lay.materialRec && data.materiais) {
    pdf.text("Materiais:", m.conteudoEsq, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(data.materiais.slice(0, 120), m.conteudoEsq + pdf.getTextWidth("Materiais:") + 2, y);
    pdf.setFont("helvetica", "normal");
    y += g(5);
  }

  if (lay.obsFicha && data.obsFicha) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Observação:", m.conteudoEsq, y);
    y += g(3);
    pdf.setFont("helvetica", "normal");
    const linhasFicha = pdf.splitTextToSize(data.obsFicha, 180);
    pdf.text(linhasFicha, m.conteudoEsq, y);
    y += linhasFicha.length * 3.8 * escalaEspacamentoRequisicao(lay) + g(2);
  }

  if (lay.mensagem?.trim()) {
    const linhasMsg = pdf.splitTextToSize(lay.mensagem.trim(), 180);
    pdf.text(linhasMsg, m.conteudoEsq, y);
    y += linhasMsg.length * 3.8 * escalaEspacamentoRequisicao(lay) + g(2);
  }

  y = desenharRodapeRequisicaoA4(
    pdf,
    lay,
    data,
    pageWidth,
    m.conteudoEsq,
    y,
    g,
    fontBase,
    "comprovante",
    linhaRequisicaoPdfSegmento,
    linhaRequisicaoPdf
  );

  if (lay.exibirBordas) {
    desenharBordaRequisicaoPdf(pdf, lay.bordas, y);
  }
}

const TERMICA_MARGEM = 4;

function pxTermicaParaMm(px: number) {
  return px * 0.264583;
}

function linhaTermica(pdf: PdfRenderApi, y: number, pageWidth: number, corHex?: string) {
  if (corHex) {
    const { r, g, b } = hexParaRgb(corHex);
    pdf.setDrawColor(r, g, b);
  }
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

function prazoFinalizadoTermica(data: PdfOsData, item: PdfItem) {
  return {
    prazo: prazoDoItemTermica(item, data),
    finalizado: (data.finalizado || "").trim(),
  };
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
  y += 10;
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

/** Modelo 4 — cupom térmica 80mm Epson T20 (layout Smart). */
function renderTermicaModelo4(
  pdf: PdfRenderApi,
  data: PdfOsData,
  layoutOverride?: OsModelo4Layout
): number {
  const lay = normalizarOsModelo4Layout(layoutOverride ?? data.layoutModelo4);
  const lab = data.lab || LAB_IMPRESSAO_PADRAO;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const cx = pageWidth / 2;
  const mx = TERMICA_MARGEM;
  const dir = pageWidth - mx;
  const corLinha = lay.bordas;
  const fs = Math.max(6.5, lay.tamanhoFonte * 0.625);
  const fsSmall = Math.max(6, fs - 0.5);
  const larguraCampo = pageWidth - mx * 2 - 24;
  let y = 5;

  if (lay.dataOs && data.dataEntrada) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fsSmall);
    pdf.text(data.dataEntrada, dir, y, { align: "right" });
    y += 4;
  }

  if (lay.logo) {
    const logoWmm = Math.min(pageWidth - mx * 2 - 2, pxTermicaParaMm(lay.logoTamanhoPx));
    const logoHmm = logoWmm * 0.85;
    const logoX = cx - logoWmm / 2 + pxTermicaParaMm(lay.logoMargemEsq) * 0.15;
    y += pxTermicaParaMm(lay.logoMargemTopo) * 0.2;
    const logoTermica = desenharLogoLab(pdf, lab, logoX, y, logoWmm, logoHmm);
    if (logoTermica.altura > 0) y += logoTermica.altura + 2;
  }

  if (lay.infoLab) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(fs + 0.5);
    pdf.text(lab.responsavel, cx, y, { align: "center" });
    y += 5;
  }

  pdf.setFontSize(fsSmall);
  const usuario = (data.usuarioCriou || "").trim();

  if (lay.numOs) {
    y = campoTermica(pdf, "Num OS:", String(data.numeroOs), mx, y, larguraCampo);
  }
  if (lay.osExterna) {
    y = campoTermica(pdf, "OS Externa:", data.osExterna || "", mx, y, larguraCampo);
  }
  if (lay.caixa) {
    y = campoTermica(pdf, "Caixa:", data.caixa, mx, y, larguraCampo);
  }
  if (lay.cliente) {
    y = campoTermica(pdf, "Cliente:", data.cliente, mx, y, larguraCampo);
  }
  if (lay.dentista) {
    y = campoTermica(pdf, "Dentista:", data.dentista, mx, y, larguraCampo);
  }
  if (lay.paciente) {
    y = campoTermica(pdf, "Paciente:", data.paciente, mx, y, larguraCampo);
  }
  if (lay.clienteTel) {
    y = campoTermica(pdf, "Telefones:", data.telefones, mx, y, larguraCampo);
  }
  if (lay.clienteEmail) {
    y = campoTermica(pdf, "Email:", data.email, mx, y, larguraCampo);
  }
  if (lay.clienteEnd) {
    y = campoTermica(pdf, "Endereço:", data.endereco, mx, y, larguraCampo);
  }
  if (lay.chavePed && data.chavePed) {
    y = campoTermica(pdf, "Chave Ped:", data.chavePed, mx, y, larguraCampo);
  }
  if (lay.usuario && usuario) {
    y = campoTermica(pdf, "Usuário:", usuario, mx, y, larguraCampo);
  }
  y += 1;

  if (lay.produtos && data.itens.length > 0) {
    linhaTermica(pdf, y, pageWidth, corLinha);
    y += 3.5;

    const colQtd = mx;
    const colDesc = mx + 8;
    const colValorUn = lay.valorUnit ? 52 : dir;
    const colDescPct = dir;
    const larguraDesc = lay.desconto ? 34 : 42;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(fsSmall - 0.5);
    pdf.text("Qtd", colQtd, y);
    pdf.text("Descrição", colDesc, y);
    if (lay.valorUnit) {
      pdf.text("Unitário", colValorUn, y, { align: "right" });
    }
    if (lay.desconto) {
      pdf.text("Descontos", colDescPct, y, { align: "right" });
    }
    y += 3;
    linhaTermica(pdf, y, pageWidth, corLinha);
    y += 3.5;

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
      pdf.setFontSize(fsSmall);
      pdf.text(String(item.qtd), colQtd, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(descricaoLinhas, colDesc, y);
      if (lay.valorUnit) {
        pdf.text(money(item.unitario), colValorUn, y, { align: "right" });
      }
      if (lay.desconto) {
        pdf.text(descTermicaPct(item.desconto), colDescPct, y, { align: "right" });
      }
      y += Math.max(3.8, descricaoLinhas.length * 3.3) + 0.5;

      pdf.setFontSize(fsSmall - 0.5);
      if (lay.numDente) {
        y = campoTermica(pdf, "Num Dente:", item.dente, mx + 1, y, larguraCampo);
      }
      if (lay.corDente) {
        y = campoTermica(pdf, "Cor Dente:", item.cor, mx + 1, y, larguraCampo);
      }
      const { prazo, finalizado } = prazoFinalizadoTermica(data, item);
      if (lay.dataPrazo || lay.finalizado) {
        pdf.setFont("helvetica", "normal");
        let xCampo = mx + 1;
        if (lay.dataPrazo && prazo) {
          pdf.text("Prazo: ", xCampo, y);
          xCampo += pdf.getTextWidth("Prazo: ");
          pdf.setFont("helvetica", "bold");
          pdf.text(prazo, xCampo, y);
          xCampo += pdf.getTextWidth(prazo) + 1.5;
          pdf.setFont("helvetica", "normal");
        }
        if (lay.finalizado && finalizado) {
          pdf.text("Finalizado: ", xCampo, y);
          xCampo += pdf.getTextWidth("Finalizado: ");
          pdf.setFont("helvetica", "bold");
          pdf.text(finalizado, xCampo, y);
          pdf.setFont("helvetica", "normal");
        }
        y += 3.6;
      }
      if (lay.colaborador && data.colaborador) {
        y = campoTermica(pdf, "Colaborador:", data.colaborador, mx + 1, y, larguraCampo);
      }
      const obsServ = item.notasAbaixo?.find((n) => /observ/i.test(n)) || "";
      if (lay.obsServico) {
        const obsTexto =
          obsServ.replace(/^observ[aã]o:\s*/i, "") || data.observacoes?.slice(0, 200) || "";
        if (obsTexto) {
          y = campoTermica(pdf, "Observação:", obsTexto, mx + 1, y, larguraCampo);
        }
      }
      pdf.setFontSize(fsSmall);
      y += 0.5;
    }

    linhaTermica(pdf, y, pageWidth, corLinha);
    y += 3.5;

    const subtotalGeral = totalServicos - totalDescontos;
    const totalFinal =
      subtotalGeral > 0 ? subtotalGeral : data.valor > 0 ? data.valor : subtotalGeral;

    if (lay.subtotal) {
      y = totalTermicaDireita(pdf, `Subtotal: ${money(subtotalGeral)}`, y, pageWidth, mx);
    }
    y = totalTermicaDireita(pdf, `Total Serviços: ${money(totalServicos)}`, y, pageWidth, mx);
    if (lay.desconto) {
      y = totalTermicaDireita(pdf, `(-) Descontos: ${money(totalDescontos)}`, y, pageWidth, mx);
    }
    if (lay.total) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(fsSmall);
      pdf.text(`(=) Total: ${money(totalFinal)}`, pageWidth - mx, y, { align: "right" });
      y += 4;
    }
    y += 1;
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fsSmall);

  if (lay.materialRec && data.materiais) {
    pdf.text("Materiais:", mx, y);
    pdf.setFont("helvetica", "bold");
    const linhasMat = pdf.splitTextToSize(data.materiais, larguraCampo);
    pdf.text(linhasMat, mx + pdf.getTextWidth("Materiais:") + 1, y);
    pdf.setFont("helvetica", "normal");
    y += Math.max(3.8, linhasMat.length * 3.5) + 1;
  }

  if (lay.obsFicha && data.obsFicha) {
    pdf.text("Observação:", mx, y);
    pdf.setFont("helvetica", "bold");
    const linhasObs = pdf.splitTextToSize(data.obsFicha, larguraCampo);
    pdf.text(linhasObs, mx + pdf.getTextWidth("Observação:") + 1, y);
    pdf.setFont("helvetica", "normal");
    y += Math.max(3.8, linhasObs.length * 3.5) + 1;
  }

  if (lay.assinatura) {
    y += 4;
    const assinW = 50;
    const assinX = cx - assinW / 2;
    const { r, g, b } = hexParaRgb(corLinha);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.25);
    pdf.line(assinX, y, assinX + assinW, y);
    y += 4;
    pdf.setFontSize(fsSmall - 0.5);
    pdf.text("recebi o(s) serviço(s) descrito acima", cx, y, { align: "center" });
    y += 5;
    pdf.line(assinX, y, assinX + assinW, y);
    y += 4;
  }

  pdf.setFontSize(fsSmall - 0.5);
  pdf.text(lab.enderecoLinha1, cx, y, { align: "center" });
  y += 3.2;
  pdf.text((lab.enderecoLinha2 || "").replace(" / ", "/"), cx, y, { align: "center" });
  y += 3.2;
  pdf.text(lab.telefones, cx, y, { align: "center" });
  y += 3.2;
  pdf.text(`email: ${lab.email}`, cx, y, { align: "center" });
  y += 4;

  if (lay.codBarras) {
    const barcodeValue = `OS${data.numeroOs}`;
    const barcodeW = 42;
    drawCode39(pdf, barcodeValue, cx - barcodeW / 2, y);
    y += 10;
  }

  return y + 2;
}

/** Modelo 5 — comprovante de entrega térmica 80mm Epson T20 (layout Smart). */
function renderTermicaModelo5(
  pdf: PdfRenderApi,
  data: PdfOsData,
  layoutOverride?: OsModelo5Layout
): number {
  const lay = normalizarOsModelo5Layout(layoutOverride ?? data.layoutModelo5);
  const lab = data.lab || LAB_IMPRESSAO_PADRAO;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const cx = pageWidth / 2;
  const mx = TERMICA_MARGEM;
  const dir = pageWidth - mx;
  const corLinha = lay.bordas;
  const fs = Math.max(6.5, lay.tamanhoFonte * 0.625);
  const fsSmall = Math.max(6, fs - 0.5);
  const larguraCampo = pageWidth - mx * 2 - 24;
  let y = 5;
  const yTopo = y;

  if (lay.logo) {
    const logoWmm = Math.min(22, pxTermicaParaMm(lay.logoTamanhoPx) * 0.47);
    const logoHmm = logoWmm * 0.85;
    const logoTermica = desenharLogoLab(pdf, lab, mx, yTopo, logoWmm, logoHmm);
    if (logoTermica.altura > 0) y = Math.max(y, yTopo + logoTermica.altura);
  }

  if (lay.dataOs && data.dataEntrada) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fsSmall);
    pdf.text(data.dataEntrada, dir, yTopo + 3, { align: "right" });
  }

  y = Math.max(y, yTopo + 4) + 1;

  if (lay.infoLab) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(fs + 0.5);
    pdf.text(lab.responsavel, cx, y, { align: "center" });
    y += 5;
  }

  pdf.setFontSize(fsSmall);
  const usuario = (data.usuarioCriou || "").trim();

  if (lay.numOs) {
    y = campoTermica(pdf, "Num OS:", String(data.numeroOs), mx, y, larguraCampo);
  }
  if (lay.osExterna) {
    y = campoTermica(pdf, "OS Interna:", data.osExterna || "", mx, y, larguraCampo);
  }
  if (lay.caixa) {
    y = campoTermica(pdf, "Caixa:", data.caixa, mx, y, larguraCampo);
  }
  if (lay.cliente) {
    y = campoTermica(pdf, "Cliente:", data.cliente, mx, y, larguraCampo);
  }
  if (lay.dentista) {
    y = campoTermica(pdf, "Dentista:", data.dentista, mx, y, larguraCampo);
  }
  if (lay.paciente) {
    y = campoTermica(pdf, "Paciente:", data.paciente, mx, y, larguraCampo);
  }
  if (lay.clienteTel) {
    y = campoTermica(pdf, "Telefone:", data.telefones, mx, y, larguraCampo);
  }
  if (lay.clienteEmail) {
    y = campoTermica(pdf, "Email:", data.email, mx, y, larguraCampo);
  }
  if (lay.clienteEnd) {
    y = campoTermica(pdf, "Endereço:", data.endereco, mx, y, larguraCampo);
  }
  if (lay.usuario && usuario) {
    y = campoTermica(pdf, "Usuário:", usuario, mx, y, larguraCampo);
  }
  y += 1;

  if (lay.produtos && data.itens.length > 0) {
    linhaTermica(pdf, y, pageWidth, corLinha);
    y += 3.5;

    const colQtd = mx;
    const colDesc = mx + 8;
    const colValorUn = lay.valorUnit ? 52 : dir;
    const colDescPct = dir;
    const larguraDesc = 44;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(fsSmall - 0.5);
    pdf.text("Qtd", colQtd, y);
    pdf.text("Descrição", colDesc, y);
    if (lay.valorUnit) {
      pdf.text("Unitário", colValorUn, y, { align: "right" });
    }
    if (lay.desconto) {
      pdf.text("Descontos", colDescPct, y, { align: "right" });
    }
    y += 3;
    linhaTermica(pdf, y, pageWidth, corLinha);
    y += 3.5;

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
      pdf.setFontSize(fsSmall);
      pdf.text(String(item.qtd), colQtd, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(descricaoLinhas, colDesc, y);
      y += Math.max(3.8, descricaoLinhas.length * 3.3) + 0.5;

      if (lay.valorUnit || lay.desconto) {
        pdf.setFontSize(fsSmall);
        if (lay.valorUnit) {
          pdf.text(money(item.unitario), colValorUn, y, { align: "right" });
        }
        if (lay.desconto) {
          pdf.text(descTermicaPct(item.desconto), colDescPct, y, { align: "right" });
        }
        y += 3.6;
      }

      pdf.setFontSize(fsSmall - 0.5);
      if (lay.numDente) {
        y = campoTermica(pdf, "Num Dente:", item.dente, mx + 1, y, larguraCampo);
      }
      if (lay.corDente) {
        y = campoTermica(pdf, "Cor Dente:", item.cor, mx + 1, y, larguraCampo);
      }
      const { prazo, finalizado } = prazoFinalizadoTermica(data, item);
      if (lay.dataPrazo || lay.finalizado) {
        pdf.setFont("helvetica", "normal");
        let xCampo = mx + 1;
        if (lay.dataPrazo && prazo) {
          pdf.text("Prazo: ", xCampo, y);
          xCampo += pdf.getTextWidth("Prazo: ");
          pdf.setFont("helvetica", "bold");
          pdf.text(prazo, xCampo, y);
          xCampo += pdf.getTextWidth(prazo) + 1.5;
          pdf.setFont("helvetica", "normal");
        }
        if (lay.finalizado && finalizado) {
          pdf.text("Finalizado: ", xCampo, y);
          xCampo += pdf.getTextWidth("Finalizado: ");
          pdf.setFont("helvetica", "bold");
          pdf.text(finalizado, xCampo, y);
          pdf.setFont("helvetica", "normal");
        }
        y += 3.6;
      }
      if (lay.colaborador && data.colaborador) {
        y = campoTermica(pdf, "Colaborador:", data.colaborador, mx + 1, y, larguraCampo);
      }
      const obsServ = item.notasAbaixo?.find((n) => /observ/i.test(n)) || "";
      if (lay.obsServico) {
        const obsTexto =
          obsServ.replace(/^observ[aã]o:\s*/i, "") || data.observacoes?.slice(0, 200) || "";
        if (obsTexto) {
          y = campoTermica(pdf, "Observação:", obsTexto, mx + 1, y, larguraCampo);
        }
      }
      pdf.setFontSize(fsSmall);
      y += 0.5;
    }

    linhaTermica(pdf, y, pageWidth, corLinha);
    y += 3.5;

    const subtotalGeral = totalServicos - totalDescontos;
    const totalFinal =
      subtotalGeral > 0 ? subtotalGeral : data.valor > 0 ? data.valor : subtotalGeral;

    if (lay.subtotal) {
      y = totalTermicaDireita(pdf, `Subtotal: ${money(subtotalGeral)}`, y, pageWidth, mx);
    }
    y = totalTermicaDireita(pdf, `Total Serviços: ${money(totalServicos)}`, y, pageWidth, mx);
    if (lay.desconto) {
      y = totalTermicaDireita(pdf, `(-) Descontos: ${money(totalDescontos)}`, y, pageWidth, mx);
    }
    if (lay.total) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(fsSmall);
      pdf.text(`(=) Total: ${money(totalFinal)}`, pageWidth - mx, y, { align: "right" });
      y += 4;
    }
    y += 1;
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fsSmall);

  if (lay.materialRec && data.materiais) {
    pdf.text("Materiais:", mx, y);
    pdf.setFont("helvetica", "bold");
    const linhasMat = pdf.splitTextToSize(data.materiais, larguraCampo);
    pdf.text(linhasMat, mx + pdf.getTextWidth("Materiais:") + 1, y);
    pdf.setFont("helvetica", "normal");
    y += Math.max(3.8, linhasMat.length * 3.5) + 1;
  }

  if (lay.obsFicha && data.obsFicha) {
    pdf.text("Observação:", mx, y);
    pdf.setFont("helvetica", "bold");
    const linhasObs = pdf.splitTextToSize(data.obsFicha, larguraCampo);
    pdf.text(linhasObs, mx + pdf.getTextWidth("Observação:") + 1, y);
    pdf.setFont("helvetica", "normal");
    y += Math.max(3.8, linhasObs.length * 3.5) + 1;
  }

  if (lay.assinatura) {
    y += 4;
    const assinW = 50;
    const assinX = cx - assinW / 2;
    const { r, g, b } = hexParaRgb(corLinha);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.25);
    pdf.line(assinX, y, assinX + assinW, y);
    y += 4;
    pdf.setFontSize(fsSmall - 0.5);
    pdf.text("recebi o(s) serviço(s) descrito acima", cx, y, { align: "center" });
    y += 5;
  }

  pdf.setFontSize(fsSmall - 0.5);
  pdf.text(lab.enderecoLinha1, cx, y, { align: "center" });
  y += 3.2;
  pdf.text((lab.enderecoLinha2 || "").replace(" / ", "/"), cx, y, { align: "center" });
  y += 3.2;
  pdf.text(lab.telefones, cx, y, { align: "center" });
  y += 3.2;
  pdf.text(`email: ${lab.email}`, cx, y, { align: "center" });
  y += 4;

  if (lay.codBarras) {
    const barcodeValue = `OS${data.numeroOs}`;
    const barcodeW = 42;
    drawCode39(pdf, barcodeValue, cx - barcodeW / 2, y);
    y += 10;
  }

  return y + 2;
}

function renderTermicaPorModelo(modelo: string) {
  if (modelo === "modelo4") {
    return (pdf: PdfRenderApi, data: PdfOsData) =>
      renderTermicaModelo4(pdf, data, data.layoutModelo4);
  }
  if (modelo === "modelo5") {
    return (pdf: PdfRenderApi, data: PdfOsData) =>
      renderTermicaModelo5(pdf, data, data.layoutModelo5);
  }
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
  function montarDadosPdf(base: PdfOsData): PdfOsData {
    if (typeof window === "undefined") {
      return { ...base, lab: base.lab || LAB_IMPRESSAO_PADRAO };
    }
    const cfg = carregarConfigLaboratorio();
    return {
      ...base,
      lab: labImpressaoFromConfig(),
      cabecalhoRequisicao: normalizarCabecalhoRequisicao(cfg.cabecalhoRequisicao),
      layoutModelo1: carregarLayoutModelo1(),
      layoutModelo2: carregarLayoutModelo2(),
      layoutModelo3: carregarLayoutModelo3(),
      layoutModelo4: carregarLayoutModelo4(),
      layoutModelo5: carregarLayoutModelo5(),
    };
  }

  const [dadosPdf, setDadosPdf] = useState<PdfOsData>(() => ({
    ...data,
    lab: data.lab || LAB_IMPRESSAO_PADRAO,
  }));
  const [configOsPronta, setConfigOsPronta] = useState(false);

  useEffect(() => {
    let ativo = true;
    setConfigOsPronta(false);
    void sincronizarConfiguracoesOsDoServidor()
      .catch(() => undefined)
      .finally(() => {
        if (!ativo) return;
        setDadosPdf(montarDadosPdf(data));
        setConfigOsPronta(true);
      });
    return () => {
      ativo = false;
    };
  }, [data]);

  useEffect(() => {
    const handler = () => {
      setDadosPdf(montarDadosPdf(data));
    };
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, handler);
    window.addEventListener(CONFIG_OS_ATUALIZADA_EVENT, handler);
    return () => {
      window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, handler);
      window.removeEventListener(CONFIG_OS_ATUALIZADA_EVENT, handler);
    };
  }, [data]);

  useEffect(() => {
    if (!configOsPronta) return;

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

      const layoutModelo2 = normalizarOsModelo2Layout(dadosPdf.layoutModelo2);
      const layoutModelo3 = normalizarOsModelo3Layout(dadosPdf.layoutModelo3);
      const pdf = new jsPDF({ unit: "mm", format: criarPdf(formato) });
      const api = pdf as unknown as PdfRenderApi;
      const renderPagina = () => {
        if (modelo === "modelo3") {
          return renderModeloComprovante(api, dadosPdf, layoutModelo3);
        }
        if (modelo === "modelo2") {
          return renderModeloProducao(api, dadosPdf, layoutModelo2);
        }
        return renderModeloProducao(api, dadosPdf, dadosPdf.layoutModelo1);
      };

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
  }, [configOsPronta, dadosPdf, formato, modelo, duasVias]);

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
            {formato === "a4" && modelo === "modelo3"
              ? "Comprovante de entrega (A4) — Modelo 3"
              : formato === "termica" && modelo === "modelo4"
                ? "Comprovante de entrega — Térmica 80mm (Modelo 4)"
                : formato === "termica" && modelo === "modelo5"
                  ? "Comprovante de entrega — Térmica 80mm (Modelo 5)"
                  : formato === "a4" && modelo === "modelo2"
                    ? "Ordem de Serviço — Modelo 2 (Produção)"
                    : formato === "a4" && modelo === "modelo1"
                      ? "Ordem de Serviço — Modelo 1 (Produção)"
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
