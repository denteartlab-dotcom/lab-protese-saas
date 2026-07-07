"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import { prepararAbaPdf, visualizarPdfUrl, baixarPdfBlob, baixarPdfUrl, criarUrlPdfNomeada, nomeArquivoOsPdf } from "@/lib/pdf-viewer";
import { LAB_IMPRESSAO_PADRAO, type LabImpressaoConfig } from "@/lib/lab-impressao";
import {
  CONFIG_LAB_PADRAO,
  configLaboratorioCabecalhoAtual,
  nomeUsuarioDocumentosLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import {
  carregarLayoutModelo1,
  carregarLayoutModelo2,
  carregarLayoutModelo3,
  carregarLayoutModelo4,
  carregarLayoutModelo5,
  sincronizarConfiguracoesOsDoServidor,
  type ConfiguracoesOs,
} from "@/lib/configuracoes-os";
import { configParaLabImpressao } from "@/lib/lab-logo";
import { sincronizarConfigLaboratorioDoServidor } from "@/lib/lab-config-sync";
import {
  aguardarArmazenamentoLaboratorioPronto,
} from "@/lib/armazenamento-laboratorio";
import { normalizarCabecalhoRequisicao, type CabecalhoRequisicaoConfig } from "@/lib/cabecalho-requisicao";
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
import { desenharCabecalhoRequisicaoPdf } from "@/lib/pdf-cabecalho-os";
import {
  dimensoesModeloEtiqueta,
  modeloEtiquetaValido,
  nomeModeloEtiqueta,
  tipografiaEtiquetaOs,
  type ModeloEtiquetaId,
  type TipografiaEtiquetaOs,
} from "@/lib/configuracoes-etiquetas";
import { parseCurrencyBr } from "@/lib/cliente-financeiro";
import { gerarBarrasCode39, gerarPngCode39DataUrl } from "@/lib/code39-barcode-core";
import { valorCodigoBarrasOs } from "@/lib/codigo-barras-os";
import {
  colaboradorExibirNoTopoImpressao,
  colaboradorMetadadosImpressao,
  formatarDataHoraEtapaImpressao,
  nomeEtapaSemSetor,
  type ColaboradorOsLinha,
  type EtapaOsLinha,
  type EtapasPorServicoOs,
} from "@/lib/etapas-os-impressao";
import { formatarDentesParaImpressaoOs } from "@/lib/dentes-os-resumo";

const CODIGO_BARRAS_ALTURA_MM = 8;
const CODIGO_BARRAS_ESTREITA_MM = 0.32;

function desenharCodigoBarrasOsNoPdf(
  pdf: {
    rect: (x: number, y: number, w: number, h: number, style?: string) => void;
    setFillColor: (r: number, g?: number, b?: number) => void;
    setFont: (fontName: string, fontStyle?: string) => void;
    setFontSize: (size: number) => void;
    text: (text: string, x: number, y: number, options?: { align?: string }) => void;
  },
  numeroOs: number | string,
  x: number,
  y: number,
  opts?: { centralizarTextoEm?: number; fontSize?: number }
): number {
  const barcodeValue = valorCodigoBarrasOs(numeroOs);
  if (!barcodeValue) return y;

  const { barras, width } = gerarBarrasCode39(barcodeValue, CODIGO_BARRAS_ESTREITA_MM);
  pdf.setFillColor(0, 0, 0);
  for (const barra of barras) {
    pdf.rect(x + barra.x, y, barra.w, CODIGO_BARRAS_ALTURA_MM, "F");
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(opts?.fontSize ?? 7);
  const textoY = y + CODIGO_BARRAS_ALTURA_MM + 2.5;
  if (opts?.centralizarTextoEm != null) {
    pdf.text(barcodeValue, opts.centralizarTextoEm, textoY, { align: "center" });
  } else {
    pdf.text(barcodeValue, x, textoY);
  }

  return textoY + 3;
}

function extrairDataPrazoBr(texto?: string | null) {
  const valor = (texto || "").trim();
  if (!valor) return "";
  const match = valor.match(/\d{2}\/\d{2}\/\d{4}/);
  return match ? match[0] : valor;
}

function formatarDescontoImpressaoOs(desconto?: string, descontoTipo?: string) {
  const texto = (desconto || "").trim();
  if (!texto || texto === "0" || texto === "0,00" || texto === "R$ 0,00") {
    return "% 0.00";
  }
  const tipo =
    descontoTipo === "valor" || texto.startsWith("R$") ? "valor" : "percentual";
  if (tipo === "valor") {
    const valor = parseCurrencyBr(texto);
    return `R$ ${valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  const numerico = texto.replace("%", "").replace(",", ".").trim();
  const pct = Number(numerico);
  if (Number.isFinite(pct)) {
    return `% ${pct.toFixed(2)}`;
  }
  if (texto.startsWith("%")) return texto;
  return `% ${texto}`;
}

type PdfItem = {
  qtd: string;
  descricao: string;
  dente: string;
  cor: string;
  unitario: number;
  desconto: string;
  descontoTipo?: string;
  notasAbaixo?: string[];
};

type PdfOsData = {
  numeroOs: number;
  /** Nome do laboratório no campo Usuário (sincronizado com login/config). */
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
  configLab?: ConfigLaboratorio;
  /** Config vinda do servidor (mesclada em configLab ao montar o PDF). */
  configLaboratorio?: ConfigLaboratorio;
  /** Layout OS salvo em Configurações › Ordem de serviço (servidor). */
  configuracoesOs?: ConfiguracoesOs;
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
  /** Colaboradores vinculados às etapas (aba OS). */
  colaboradoresLista?: ColaboradorOsLinha[];
  /** Lista estruturada de etapas para impressão (checkbox + data/hora + colaborador + nome + obs). */
  etapasLista?: EtapaOsLinha[];
  /** Etapas separadas por serviço quando a OS tem mais de um trabalho de serviço. */
  etapasPorServico?: EtapasPorServicoOs[];
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

function descontoCelula(desconto: string, descontoTipo?: string) {
  const texto = (desconto || "").trim();
  if (!texto) return "% 0.00";
  if (texto.startsWith("%") || texto.startsWith("R$")) return texto;
  return formatarDescontoImpressaoOs(desconto, descontoTipo);
}

type PdfTextoApi = {
  splitTextToSize: (text: string, maxWidth: number) => string[];
  text: (text: string | string[], x: number, y: number, options?: { align?: string }) => void;
};

function textoDenteParaImpressao(dente: string) {
  return formatarDentesParaImpressaoOs(dente) || String(dente || "").trim();
}

function larguraColunaDente(colDente: number, colCor: number, temCor: boolean) {
  return Math.max(14, temCor ? colCor - colDente - 2 : 20);
}

function linhasDenteItem(pdf: PdfTextoApi, dente: string, largura: number) {
  const texto = textoDenteParaImpressao(dente);
  if (!texto || texto === "-") return [""];
  return pdf.splitTextToSize(texto, largura);
}

function desenharDenteCelula(
  pdf: PdfTextoApi,
  dente: string,
  x: number,
  y: number,
  largura: number,
  alturaLinha: number
) {
  const linhas = linhasDenteItem(pdf, dente, largura);
  let cy = y;
  for (const linha of linhas) {
    if (linha) pdf.text(linha, x, cy, { align: "center" });
    cy += alturaLinha;
  }
  return Math.max(1, linhas.length);
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

function desenharCheckboxEtapaPdf(pdf: PdfRenderApi, x: number, y: number, tamanho = 3) {
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.25);
  pdf.rect(x, y - tamanho + 0.6, tamanho, tamanho);
}

type EtapaImpressaoHorizontal = {
  nome: string;
  dataHora: string;
  colaborador: string;
  obs: string;
};

function infoEtapaImpressaoHorizontal(
  etapa: EtapaOsLinha,
  data: PdfOsData,
  lay: OsModelo1Layout
): EtapaImpressaoHorizontal | null {
  const nome = nomeEtapaSemSetor(etapa.nome);
  if (!nome) return null;
  return {
    nome,
    dataHora: lay.etapasComDatas
      ? formatarDataHoraEtapaImpressao(etapa.prazo, data.dataEntrada)
      : "",
    colaborador: "",
    obs: (etapa.observacao || "").trim(),
  };
}

type BlocoEtapasImpressaoPdf = {
  tituloServico?: string;
  etapas: EtapaOsLinha[];
};

function blocosEtapasImpressaoPdf(data: PdfOsData): BlocoEtapasImpressaoPdf[] {
  const porServico = (data.etapasPorServico || []).filter((bloco) => bloco.etapas.length > 0);
  if (porServico.length > 0) {
    const multiplos = porServico.length > 1;
    return porServico.map((bloco) => ({
      tituloServico: multiplos ? bloco.titulo : undefined,
      etapas: bloco.etapas,
    }));
  }
  const etapas = data.etapasLista || [];
  if (etapas.length === 0) return [];
  return [{ etapas }];
}

function larguraEtapaHorizontalPdf(
  pdf: PdfRenderApi,
  info: EtapaImpressaoHorizontal,
  fontBase: number,
  checkbox: number
) {
  let largura = checkbox + 2.5;
  pdf.setFontSize(fontBase);
  pdf.setFont("helvetica", "normal");
  if (info.dataHora) largura += pdf.getTextWidth(info.dataHora) + 1.5;
  if (info.colaborador) {
    pdf.setFont("helvetica", "bold");
    largura += pdf.getTextWidth(info.colaborador) + 1.5;
  }
  pdf.setFont("helvetica", "bold");
  largura += pdf.getTextWidth(info.nome);
  if (info.obs) {
    pdf.setFont("helvetica", "normal");
    largura += 1.5 + pdf.getTextWidth(info.obs);
  }
  return largura + 5;
}

function desenharEtapaHorizontalPdf(
  pdf: PdfRenderApi,
  info: EtapaImpressaoHorizontal,
  x: number,
  y: number,
  fontBase: number,
  checkbox: number
) {
  desenharCheckboxEtapaPdf(pdf, x, y, checkbox);
  let cursor = x + checkbox + 2.5;
  pdf.setFontSize(fontBase);

  if (info.dataHora) {
    pdf.setFont("helvetica", "normal");
    pdf.text(info.dataHora, cursor, y);
    cursor += pdf.getTextWidth(info.dataHora) + 1.5;
  }

  if (info.colaborador) {
    pdf.setFont("helvetica", "bold");
    pdf.text(info.colaborador, cursor, y);
    cursor += pdf.getTextWidth(info.colaborador) + 1.5;
  }

  pdf.setFont("helvetica", "bold");
  pdf.text(info.nome, cursor, y);
  cursor += pdf.getTextWidth(info.nome) + 1.5;

  if (info.obs) {
    pdf.setFont("helvetica", "normal");
    pdf.text(info.obs, cursor, y);
  }

  pdf.setFont("helvetica", "normal");
}

/** Bloco Etapas: checkbox + data/hora + colaborador + nome lado a lado (com quebra de linha se necessário). */
function desenharEtapasOsRequisicao(
  pdf: PdfRenderApi,
  lay: OsModelo1Layout,
  data: PdfOsData,
  x: number,
  yInicio: number,
  gapMm: (mm: number) => number,
  fontBase: number
) {
  const blocos = blocosEtapasImpressaoPdf(data);
  if (!lay.etapas || blocos.length === 0) return yInicio;

  const larguraUtil = 182 - x;
  const checkbox = 3;
  const alturaLinha = gapMm(4);
  let y = yInicio;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontBase);

  for (const bloco of blocos) {
    const infos = bloco.etapas
      .map((etapa) => infoEtapaImpressaoHorizontal(etapa, data, lay))
      .filter(Boolean) as EtapaImpressaoHorizontal[];
    if (infos.length === 0) continue;

    const rotulo = bloco.tituloServico
      ? `${bloco.tituloServico} — Etapas:`
      : "Etapas:";
    pdf.text(rotulo, x, y);
    y += gapMm(4);

    let cursorX = x;
    let rowY = y;

    for (const info of infos) {
      const larguraEtapa = larguraEtapaHorizontalPdf(pdf, info, fontBase, checkbox);
      if (cursorX > x && cursorX + larguraEtapa - 5 > x + larguraUtil) {
        cursorX = x;
        rowY += alturaLinha;
      }
      desenharEtapaHorizontalPdf(pdf, info, cursorX, rowY, fontBase, checkbox);
      cursorX += larguraEtapa;
    }

    y = rowY + alturaLinha + gapMm(1.5);
  }

  return y;
}

function desenharEtapasOsTermica(
  pdf: PdfRenderApi,
  lay: OsModelo1Layout,
  data: PdfOsData,
  mx: number,
  yInicio: number,
  larguraCampo: number,
  fsSmall: number
) {
  const blocos = blocosEtapasImpressaoPdf(data);
  if (!lay.etapas || blocos.length === 0) return yInicio;

  const checkbox = 2.5;
  const alturaLinha = 3.6;
  let y = yInicio;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fsSmall - 0.5);

  for (const bloco of blocos) {
    const infos = bloco.etapas
      .map((etapa) => infoEtapaImpressaoHorizontal(etapa, data, lay))
      .filter(Boolean) as EtapaImpressaoHorizontal[];
    if (infos.length === 0) continue;

    const rotulo = bloco.tituloServico
      ? `${bloco.tituloServico} — Etapas:`
      : "Etapas:";
    pdf.text(rotulo, mx, y);
    y += 3.6;

    let cursorX = mx;
    let rowY = y;

    for (const info of infos) {
      const larguraEtapa = larguraEtapaHorizontalPdf(pdf, info, fsSmall - 0.5, checkbox);
      if (cursorX > mx && cursorX + larguraEtapa - 3 > mx + larguraCampo) {
        cursorX = mx;
        rowY += alturaLinha;
      }
      desenharEtapaHorizontalPdf(pdf, info, cursorX, rowY, fsSmall - 0.5, checkbox);
      cursorX += larguraEtapa;
    }

    y = rowY + alturaLinha + 1;
  }

  return y;
}

function desenharMetadadosServicoRequisicao(
  pdf: PdfRenderApi,
  lay: OsModelo1Layout,
  data: PdfOsData,
  colDesc: number,
  yInicio: number,
  gapMm: (mm: number) => number
) {
  let y = yInicio;
  const mostraPrazo = lay.dataPrazo || lay.finalizado;
  const etapasLista = data.etapasLista || [];
  const mostraColab = colaboradorExibirNoTopoImpressao(lay.colaborador, lay.etapas, etapasLista);
  const mostraProd = lay.producao && Boolean(data.producao?.trim());

  if (!mostraPrazo && !mostraColab && !mostraProd) {
    return y;
  }

  if (mostraPrazo) {
    desenharPrazoFinalizadoRequisicao(pdf, lay, data, colDesc, y);
    y += gapMm(4);
  }
  if (mostraColab) {
    labelValue(
      pdf,
      "Colaborador: ",
      colaboradorMetadadosImpressao({
        explicito: data.colaborador,
        colaboradores: data.colaboradoresLista,
        etapas: etapasLista,
      }),
      colDesc,
      y
    );
    y += gapMm(4);
  }
  if (mostraProd) {
    labelValue(pdf, "Produção: ", data.producao || "", colDesc, y);
    y += gapMm(4);
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
  gapMm: (mm: number) => number,
  fontBase: number,
  variante: VarianteRodapeRequisicao,
  linhaSegmento: (
    pdf: PdfRenderApi,
    lay: OsModelo1Layout,
    x1: number,
    y: number,
    x2: number
  ) => void,
  linhaPagina: (_pdf: PdfRenderApi, _lay: OsModelo1Layout, _y: number, _pageWidth: number) => void
) {
  let y = yInicio;

  if (lay.assinatura) {
    y += gapMm(6);
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
    y += gapMm(6);
  }

  if (lay.codBarras) {
    if (!lay.assinatura) {
      y += gapMm(4);
    }
    y = desenharCodigoBarrasOsNoPdf(pdf, data.numeroOs, conteudoEsq, y);
  }

  return y;
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

  pdf.setFontSize(8.5);
  const statusOs = (data.status || data.producao || "").trim();
  desenharRotuloValorDireita("Status: ", statusOs || "—", yDir);
  yDir += 4.5;

  const usuario = (data.usuarioCriou || "").trim();
  if (lay.usuario) {
    desenharRotuloValorDireita("Usuário: ", usuario || "—", yDir);
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
  const { r, g: gVerde, b } = hexParaRgb(corHex);
  const pw = pdf.internal.pageSize.getWidth();
  const m = OS_MODELO1_BORDA_MARGEM_MM;
  const yTop = yTopoBordaRequisicaoPdf();
  const yBottom = yFimConteudo + OS_REQUISICAO_BORDA_PADDING_MM;
  const t = OS_REQUISICAO_BORDA_EXTERNA_MM;
  const w = pw - m * 2;
  const h = Math.max(t, yBottom - yTop);
  pdf.setFillColor(r, gVerde, b);
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
  const { r, g: gVerde, b } = hexParaRgb(OS_REQUISICAO_LINHA_DIVISAO_COR);
  pdf.setFillColor(r, gVerde, b);
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
  const { r, g: gVerde, b } = hexParaRgb(OS_REQUISICAO_LINHA_DIVISAO_COR);
  pdf.setFillColor(r, gVerde, b);
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
  const gapMm = (mm: number) => gapRequisicaoMm(lay, mm);
  const colDir = 110;
  let y = desenharCabecalhoRequisicaoPdf(pdf, {
    lab: data.lab,
    configLab: data.configLab,
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
    y += gapMm(4);
  }
  if (lay.cliente) {
    labelValue(pdf, "Cliente:", data.cliente, m.conteudoEsq, y);
  }
  if (lay.caixa) {
    labelValue(pdf, "Caixa:", data.caixa, colDir, y, "");
  }
  if (lay.cliente || lay.caixa) y += gapMm(4);
  if (lay.dentista) {
    labelValue(pdf, "Dentista:", data.dentista, m.conteudoEsq, y);
  }
  if (lay.clienteTel) {
    pdf.text(`Telefones: ${data.telefones}`, colDir, y);
  }
  if (lay.dentista || lay.clienteTel) y += gapMm(4);
  if (lay.paciente) {
    labelValue(pdf, "Paciente:", data.paciente, m.conteudoEsq, y);
  }
  if (lay.clienteEnd) {
    pdf.text(`Endereço: ${data.endereco}`, colDir, y);
  }
  if (lay.paciente || lay.clienteEnd) y += gapMm(4);
  if (lay.clienteEmail) {
    pdf.text(`Email: ${data.email}`, lay.clienteTel ? m.conteudoEsq : colDir, y);
    y += gapMm(4);
  }

  y += gapMm(2);
  linhaRequisicaoPdf(pdf, lay, y, pageWidth);
  y += gapMm(4);

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
  y += gapMm(2);
  linhaRequisicaoPdf(pdf, lay, y, pageWidth);
  y += gapMm(4);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontBase);
  const totalItens = data.itens.length;
  data.itens.forEach((item, indiceItem) => {
    if (y > 265) {
      pdf.addPage();
      y = OS_REQUISICAO_MARGEM_CONTEUDO_MM + 1;
    }
    const descricaoLinhas = pdf.splitTextToSize(String(item.descricao), lay.subtotal ? 58 : 68);
    const alturaLinha = 4.2 * escalaEspacamentoRequisicao(lay);
    const larguraDente = larguraColunaDente(colDente, colCor, lay.corDente);

    pdf.text(String(item.qtd), colQtd, y);
    pdf.text(descricaoLinhas, colDesc, y);
    const denteLinhas = lay.numDente
      ? desenharDenteCelula(pdf, item.dente, colDente, y, larguraDente, alturaLinha)
      : 1;
    if (lay.corDente) pdf.text(String(item.cor).slice(0, 16), colCor, y, { align: "center" });
    if (lay.valorUnit) pdf.text(unitarioTabela(item.unitario), colUnit, y, { align: "right" });
    if (lay.desconto) pdf.text(descontoCelula(item.desconto, item.descontoTipo), colDescPct, y, { align: "right" });
    if (lay.subtotal) {
      pdf.text(unitarioTabela(subtotalItem(item)), colSubtotalDir, y, { align: "right" });
    }
    y += Math.max(gapMm(4), descricaoLinhas.length * alturaLinha, denteLinhas * alturaLinha);

    if (indiceItem < totalItens - 1) {
      y += gapMm(1);
      linhaRequisicaoPdf(pdf, lay, y, pageWidth);
      y += gapMm(4);
    } else {
      y += gapMm(1);
    }
  });

  y = desenharMetadadosServicoRequisicao(pdf, lay, data, colDesc, y, gapMm);
  y += gapMm(5);
  y = desenharEtapasOsRequisicao(pdf, lay, data, m.conteudoEsq, y, gapMm, fontBase);

  if (lay.total) {
    linhaRequisicaoPdf(pdf, lay, y, pageWidth);
    y += gapMm(3);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total ${money(data.valor)}`, m.tabelaDir, y, { align: "right" });
    y += gapMm(6);
  } else {
    linhaRequisicaoPdf(pdf, lay, y, pageWidth);
    y += gapMm(4);
  }

  pdf.setFont("helvetica", "normal");
  if (lay.materialRec && data.materiais) {
    labelValue(pdf, "Materiais: ", data.materiais.slice(0, 110), m.conteudoEsq, y);
    y += gapMm(5);
  }
  if (lay.obsFicha && data.obsFicha) {
    labelValue(pdf, "Observação: ", data.obsFicha.slice(0, 110), m.conteudoEsq, y);
    y += gapMm(5);
  }
  if (lay.pecas && data.pecas) {
    labelValue(pdf, "Peças: ", data.pecas.slice(0, 110), m.conteudoEsq, y);
    y += gapMm(5);
  }
  if (lay.mensagem?.trim()) {
    const linhasMsg = pdf.splitTextToSize(lay.mensagem.trim(), 180);
    pdf.text(linhasMsg, m.conteudoEsq, y);
    y += linhasMsg.length * 3.8 * escalaEspacamentoRequisicao(lay) + gapMm(2);
  }

  y = desenharRodapeRequisicaoA4(
    pdf,
    lay,
    data,
    pageWidth,
    m.conteudoEsq,
    y,
    gapMm,
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
  const descontoTexto = (item.desconto || "").trim();
  if (item.descontoTipo === "valor" || descontoTexto.startsWith("R$")) {
    return Math.max(bruto - parseCurrencyBr(descontoTexto), 0);
  }
  const pct = parseDescontoPct(descontoTexto);
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
  const gapMm = (mm: number) => gapRequisicaoMm(lay, mm);
  const colDir = 110;
  let y = desenharCabecalhoRequisicaoPdf(pdf, {
    lab: data.lab,
    configLab: data.configLab,
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
  if (lay.numOs || lay.osExterna) y += gapMm(4);

  if (lay.cliente) {
    labelValue(pdf, "Cliente:", data.cliente, m.conteudoEsq, y);
  }
  if (lay.caixa) {
    labelValue(pdf, "Caixa:", data.caixa, colDir, y, "");
  }
  if (lay.cliente || lay.caixa) y += gapMm(4);

  if (lay.dentista) {
    labelValue(pdf, "Dentista:", data.dentista, m.conteudoEsq, y);
  }
  if (lay.clienteTel) {
    pdf.text(`Telefones: ${data.telefones}`, colDir, y);
  }
  if (lay.dentista || lay.clienteTel) y += gapMm(4);

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
  if (lay.paciente || lay.clienteEmail) y += gapMm(4);

  if (lay.clienteEnd) {
    pdf.text(`Endereço: ${data.endereco}`, colDir, y);
    y += gapMm(4);
  }

  y += gapMm(2);
  linhaRequisicaoPdf(pdf, lay, y, pageWidth);
  y += gapMm(4);

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
  y += gapMm(2);
  linhaRequisicaoPdf(pdf, lay, y, pageWidth);
  y += gapMm(4);

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
    const alturaLinha = 4.2 * escalaEspacamentoRequisicao(lay);
    const larguraDente = larguraColunaDente(colDente, colCor, lay.corDente);
    pdf.text(String(item.qtd), colQtd, y);
    pdf.text(descricaoLinhas, colDesc, y);
    const denteLinhas = lay.numDente
      ? desenharDenteCelula(pdf, item.dente, colDente, y, larguraDente, alturaLinha)
      : 1;
    if (lay.corDente) pdf.text(String(item.cor).slice(0, 16), colCor, y, { align: "center" });
    if (lay.valorUnit) pdf.text(unitarioTabela(item.unitario), colUnit, y, { align: "right" });
    if (lay.desconto) {
      pdf.text(descontoCelula(item.desconto).replace(".", ","), colDescPct, y, { align: "right" });
    }
    if (lay.subtotal) {
      pdf.text(unitarioTabela(subtotal), colSubtotal, y, { align: "right" });
    }
    y += Math.max(gapMm(4), descricaoLinhas.length * alturaLinha, denteLinhas * alturaLinha);
    y += gapMm(1);
  });

  y = desenharMetadadosServicoRequisicao(pdf, lay, data, colDesc, y, gapMm);
  y += gapMm(5);
  y = desenharEtapasOsRequisicao(pdf, lay, data, m.conteudoEsq, y, gapMm, fontBase);

  y += gapMm(1);
  linhaRequisicaoPdf(pdf, lay, y, pageWidth);
  y += gapMm(5);

  const totalFinal = totalServicos - totalDescontos;
  if (lay.total) {
    const blocoTotalX = 118;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(fontBase + 1);
    pdf.text("TOTAL SERVIÇOS", blocoTotalX, y);
    pdf.text(money(totalServicos), m.tabelaDir, y, { align: "right" });
    y += gapMm(4);
    pdf.text("(-) DESCONTOS", blocoTotalX, y);
    pdf.text(money(totalDescontos), m.tabelaDir, y, { align: "right" });
    y += gapMm(4);
    pdf.text("(=) TOTAL", blocoTotalX, y);
    pdf.text(money(totalFinal > 0 ? totalFinal : data.valor), m.tabelaDir, y, { align: "right" });
    y += gapMm(4);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontBase);
  }

  if (lay.materialRec && data.materiais) {
    pdf.text("Materiais:", m.conteudoEsq, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(data.materiais.slice(0, 120), m.conteudoEsq + pdf.getTextWidth("Materiais:") + 2, y);
    pdf.setFont("helvetica", "normal");
    y += gapMm(5);
  }

  if (lay.obsFicha && data.obsFicha) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Observação:", m.conteudoEsq, y);
    y += gapMm(3);
    pdf.setFont("helvetica", "normal");
    const linhasFicha = pdf.splitTextToSize(data.obsFicha, 180);
    pdf.text(linhasFicha, m.conteudoEsq, y);
    y += linhasFicha.length * 3.8 * escalaEspacamentoRequisicao(lay) + gapMm(2);
  }

  if (lay.mensagem?.trim()) {
    const linhasMsg = pdf.splitTextToSize(lay.mensagem.trim(), 180);
    pdf.text(linhasMsg, m.conteudoEsq, y);
    y += linhasMsg.length * 3.8 * escalaEspacamentoRequisicao(lay) + gapMm(2);
  }

  y = desenharRodapeRequisicaoA4(
    pdf,
    lay,
    data,
    pageWidth,
    m.conteudoEsq,
    y,
    gapMm,
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
    const { r, g: gVerde, b } = hexParaRgb(corHex);
    pdf.setDrawColor(r, gVerde, b);
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
    y = campoTermica(pdf, "Num Dente:", textoDenteParaImpressao(item.dente), mx + 2, y, larguraTexto - 22);
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

  const barcodeValue = valorCodigoBarrasOs(data.numeroOs);
  const { width: barcodeW } = gerarBarrasCode39(barcodeValue, CODIGO_BARRAS_ESTREITA_MM);
  y = desenharCodigoBarrasOsNoPdf(pdf, data.numeroOs, cx - barcodeW / 2, y, {
    centralizarTextoEm: cx,
    fontSize: 6.5,
  });

  return y + 2;
}

function descTermicaPct(desconto: string, descontoTipo?: string) {
  return formatarDescontoImpressaoOs(desconto, descontoTipo);
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
  if (lay.usuario) {
    y = campoTermica(pdf, "Usuário:", usuario || "—", mx, y, larguraCampo);
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
    const etapasLista = data.etapasLista || [];
    const mostraColabItem = colaboradorExibirNoTopoImpressao(
      lay.colaborador,
      lay.etapas,
      etapasLista
    );
    const textoColaboradorTopo = colaboradorMetadadosImpressao({
      explicito: data.colaborador,
      colaboradores: data.colaboradoresLista,
      etapas: etapasLista,
    });

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
        pdf.text(descTermicaPct(item.desconto, item.descontoTipo), colDescPct, y, { align: "right" });
      }
      y += Math.max(3.8, descricaoLinhas.length * 3.3) + 0.5;

      pdf.setFontSize(fsSmall - 0.5);
      if (lay.numDente) {
        y = campoTermica(pdf, "Num Dente:", textoDenteParaImpressao(item.dente), mx + 1, y, larguraCampo);
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
      if (mostraColabItem) {
        y = campoTermica(
          pdf,
          "Colaborador:",
          textoColaboradorTopo || "",
          mx + 1,
          y,
          larguraCampo
        );
      }
      pdf.setFontSize(fsSmall);
      y += 0.5;
    }

    y += 5;
    y = desenharEtapasOsTermica(pdf, lay, data, mx, y, larguraCampo, fsSmall);

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
    const { r, g: gVerde, b } = hexParaRgb(corLinha);
    pdf.setDrawColor(r, gVerde, b);
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
    const barcodeValue = valorCodigoBarrasOs(data.numeroOs);
    const { width: barcodeW } = gerarBarrasCode39(barcodeValue, CODIGO_BARRAS_ESTREITA_MM);
    y = desenharCodigoBarrasOsNoPdf(pdf, data.numeroOs, cx - barcodeW / 2, y, {
      centralizarTextoEm: cx,
      fontSize: 6.5,
    });
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
  if (lay.usuario) {
    y = campoTermica(pdf, "Usuário:", usuario || "—", mx, y, larguraCampo);
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
    const etapasLista = data.etapasLista || [];
    const mostraColabItem = colaboradorExibirNoTopoImpressao(
      lay.colaborador,
      lay.etapas,
      etapasLista
    );
    const textoColaboradorTopo = colaboradorMetadadosImpressao({
      explicito: data.colaborador,
      colaboradores: data.colaboradoresLista,
      etapas: etapasLista,
    });

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
          pdf.text(descTermicaPct(item.desconto, item.descontoTipo), colDescPct, y, { align: "right" });
        }
        y += 3.6;
      }

      pdf.setFontSize(fsSmall - 0.5);
      if (lay.numDente) {
        y = campoTermica(pdf, "Num Dente:", textoDenteParaImpressao(item.dente), mx + 1, y, larguraCampo);
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
      if (mostraColabItem) {
        y = campoTermica(
          pdf,
          "Colaborador:",
          textoColaboradorTopo || "",
          mx + 1,
          y,
          larguraCampo
        );
      }
      pdf.setFontSize(fsSmall);
      y += 0.5;
    }

    y += 5;
    y = desenharEtapasOsTermica(pdf, lay, data, mx, y, larguraCampo, fsSmall);

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
    const { r, g: gVerde, b } = hexParaRgb(corLinha);
    pdf.setDrawColor(r, gVerde, b);
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
    const barcodeValue = valorCodigoBarrasOs(data.numeroOs);
    const { width: barcodeW } = gerarBarrasCode39(barcodeValue, CODIGO_BARRAS_ESTREITA_MM);
    y = desenharCodigoBarrasOsNoPdf(pdf, data.numeroOs, cx - barcodeW / 2, y, {
      centralizarTextoEm: cx,
      fontSize: 6.5,
    });
  }

  return y + 2;
}

function gapLinhaEtiqueta(y: number, fs: number, tip: TipografiaEtiquetaOs) {
  return y + Math.max(0.5, tip.espacoLinhaMm - fs * 0.38);
}

function prazoEtiquetaOs(data: PdfOsData) {
  const fontes = [
    data.prazo,
    data.prazoLaboratorio,
    data.prazoDentista,
    data.prazoLinhaServico,
    data.finalizado,
    data.dataEntrada,
  ];
  for (const fonte of fontes) {
    const dataFmt = extrairDataPrazoBr(fonte);
    if (dataFmt) return dataFmt;
  }
  const nota = data.itens.find((item) => item.notasAbaixo?.length)?.notasAbaixo?.[0];
  return extrairDataPrazoBr(nota);
}

function linhaEtiquetaRotulo(
  pdf: PdfRenderApi,
  rotulo: string,
  valor: string,
  x: number,
  y: number,
  larguraUtil: number,
  fs: number,
  alturaMax: number
) {
  if (y > alturaMax) return y;

  pdf.setFontSize(fs);
  pdf.setFont("helvetica", "bold");
  pdf.text(rotulo, x, y);
  const rotuloW = pdf.getTextWidth(rotulo);

  pdf.setFont("helvetica", "normal");
  const texto = valor.trim();
  if (!texto) {
    return y + fs * 0.45;
  }

  const partes = pdf.splitTextToSize(texto, Math.max(4, larguraUtil - rotuloW));
  pdf.text(partes[0] || "", x + rotuloW, y);
  y += fs * 0.45;

  for (let i = 1; i < partes.length; i++) {
    if (y > alturaMax) break;
    pdf.text(partes[i], x, y);
    y += fs * 0.45;
  }

  return y;
}

function textoEtiquetaOs(
  pdf: PdfRenderApi,
  texto: string,
  x: number,
  y: number,
  larguraUtil: number,
  fs: number,
  alturaMax: number
) {
  pdf.setFontSize(fs);
  pdf.setFont("helvetica", "normal");
  const partes = pdf.splitTextToSize(texto, larguraUtil);
  for (const parte of partes) {
    if (y > alturaMax) return y;
    pdf.text(parte, x, y);
    y += fs * 0.45;
  }
  return y;
}

async function renderEtiquetaOs(
  pdf: PdfRenderApi,
  data: PdfOsData,
  modeloEtiqueta: ModeloEtiquetaId
) {
  const { larguraMm, alturaMm } = dimensoesModeloEtiqueta(modeloEtiqueta);
  const tip = tipografiaEtiquetaOs(modeloEtiqueta);
  const margem = tip.margemMm;
  const larguraUtil = larguraMm - margem * 2;
  const alturaMax = alturaMm - margem;
  const item = data.itens[0];
  const codigoBarras = valorCodigoBarrasOs(data.numeroOs);
  const barcodeY = margem;

  const barcodeImg = gerarPngCode39DataUrl(codigoBarras, {
    narrowPx: tip.barcodeNarrowPx,
    heightPx: tip.barcodeHeightPx,
  });

  let barcodeW = 0;
  if (barcodeImg) {
    barcodeW = (barcodeImg.widthPx / barcodeImg.heightPx) * tip.barcodeAlturaMm;
    pdf.addImage(
      barcodeImg.dataUrl,
      "PNG",
      margem,
      barcodeY,
      barcodeW,
      tip.barcodeAlturaMm
    );
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(Math.max(5, tip.fsOs - 1));
    pdf.text(codigoBarras, margem + barcodeW / 2, margem + tip.barcodeAlturaMm + 2, {
      align: "center",
    });
  } else {
    barcodeW = gerarBarrasCode39(codigoBarras, CODIGO_BARRAS_ESTREITA_MM).width;
    desenharCodigoBarrasOsNoPdf(pdf, data.numeroOs, margem, barcodeY, {
      fontSize: Math.max(5, tip.fsOs - 1),
    });
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(tip.fsOs);
  const osX = margem + barcodeW + tip.gapNumeroOsMm;
  pdf.text(String(data.numeroOs), osX, margem + tip.barcodeAlturaMm * 0.78);

  let y = margem + tip.barcodeAlturaMm + tip.gapAposBarcodeMm + 2;

  if (data.cliente) {
    y = linhaEtiquetaRotulo(
      pdf,
      "Cliente: ",
      data.cliente,
      margem,
      y,
      larguraUtil,
      tip.fsTexto,
      alturaMax
    );
    y = gapLinhaEtiqueta(y, tip.fsTexto, tip);
  }

  if (data.paciente) {
    y = linhaEtiquetaRotulo(
      pdf,
      "Paciente: ",
      data.paciente,
      margem,
      y,
      larguraUtil,
      tip.fsTexto,
      alturaMax
    );
    y = gapLinhaEtiqueta(y, tip.fsTexto, tip);
  }

  if (item?.descricao) {
    const qtd = item.qtd?.trim() || "1";
    y = textoEtiquetaOs(
      pdf,
      `${qtd} ${item.descricao}`.trim(),
      margem,
      y,
      larguraUtil,
      tip.fsTexto,
      alturaMax
    );
    y = gapLinhaEtiqueta(y, tip.fsTexto, tip);
  }

  const prazo = prazoEtiquetaOs(data);
  linhaEtiquetaRotulo(
    pdf,
    "Prazo: ",
    prazo,
    margem,
    y,
    larguraUtil,
    tip.fsTexto,
    alturaMax
  );

  return y;
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
  const pdfBlobRef = useRef<Blob | null>(null);
  const pdfUrlRef = useRef("");
  const dadosPdfRef = useRef<PdfOsData>(data as PdfOsData);
  const buildPdfSeqRef = useRef(0);
  const nomeArquivoPdf = nomeArquivoOsPdf(data.numeroOs);

  function layoutsOsParaPdf(base: PdfOsData, cfgOs?: ConfiguracoesOs | null) {
    const remoto = cfgOs ?? base.configuracoesOs;
    return {
      layoutModelo1: remoto?.layoutModelo1 ?? carregarLayoutModelo1(),
      layoutModelo2: remoto?.layoutModelo2 ?? carregarLayoutModelo2(),
      layoutModelo3: remoto?.layoutModelo3 ?? carregarLayoutModelo3(),
      layoutModelo4: remoto?.layoutModelo4 ?? carregarLayoutModelo4(),
      layoutModelo5: remoto?.layoutModelo5 ?? carregarLayoutModelo5(),
    };
  }

  function montarDadosPdfDeServidor(base: PdfOsData): PdfOsData {
    if (typeof window === "undefined") {
      return { ...base, lab: base.lab || LAB_IMPRESSAO_PADRAO };
    }
    try {
      const cfg = configLaboratorioCabecalhoAtual();
      const lab = configParaLabImpressao(cfg);
      const usuarioLaboratorio =
        nomeUsuarioDocumentosLaboratorio(cfg) ||
        base.usuarioCriou?.trim() ||
        lab.responsavel?.trim() ||
        "";
      return {
        ...base,
        usuarioCriou: usuarioLaboratorio,
        lab,
        configLab: cfg,
        cabecalhoRequisicao: normalizarCabecalhoRequisicao(cfg.cabecalhoRequisicao),
        ...layoutsOsParaPdf(base),
      };
    } catch (err) {
      console.error("[PdfOsViewer] montarDadosPdf", err);
      const cfg = configLaboratorioCabecalhoAtual();
      const lab = configParaLabImpressao(cfg);
      return {
        ...base,
        lab,
        configLab: cfg,
        cabecalhoRequisicao: normalizarCabecalhoRequisicao(cfg.cabecalhoRequisicao),
        layoutModelo1: normalizarOsModelo1Layout(null),
        layoutModelo2: normalizarOsModelo2Layout(null),
        layoutModelo3: normalizarOsModelo3Layout(null),
        layoutModelo4: normalizarOsModelo4Layout(null),
        layoutModelo5: normalizarOsModelo5Layout(null),
      };
    }
  }

  function publicarPdfGerado(blob: Blob, seq: number) {
    pdfBlobRef.current = blob;
    const blobUrl = criarUrlPdfNomeada(blob, nomeArquivoPdf);
    if (seq !== buildPdfSeqRef.current) {
      if (blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl);
      return "";
    }
    const anterior = pdfUrlRef.current;
    pdfUrlRef.current = blobUrl;
    setPdfUrl(blobUrl);
    if (anterior.startsWith("blob:") && anterior !== blobUrl) {
      URL.revokeObjectURL(anterior);
    }
    return blobUrl;
  }

  const [dadosPdf, setDadosPdf] = useState<PdfOsData>(() => montarDadosPdfDeServidor(data));
  dadosPdfRef.current = dadosPdf;
  const [configOsPronta, setConfigOsPronta] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function prepararConfigImpressao() {
      setPdfUrl("");
      setErroPdf("");
      setConfigOsPronta(false);
      await aguardarArmazenamentoLaboratorioPronto();
      try {
        await Promise.all([
          sincronizarConfigLaboratorioDoServidor(),
          sincronizarConfiguracoesOsDoServidor(),
        ]);
      } catch {
        /* offline */
      }
      if (!ativo) return;
      try {
        const montado = montarDadosPdfDeServidor(data);
        dadosPdfRef.current = montado;
        setDadosPdf(montado);
      } catch (err) {
        console.error("[PdfOsViewer] preparar config", err);
      }
      setConfigOsPronta(true);
    }

    void prepararConfigImpressao();
    return () => {
      ativo = false;
    };
  }, [data]);

  useEffect(() => {
    if (!configOsPronta) return;

    const seq = ++buildPdfSeqRef.current;

    async function buildPdf() {
      setErroPdf("");
      const dadosAtuais = dadosPdfRef.current;
      const { jsPDF } = await import("jspdf");
      if (seq !== buildPdfSeqRef.current) return;

      if (formato === "termica") {
        const renderTermica = renderTermicaPorModelo(modelo);
        const medida = new jsPDF({ unit: "mm", format: [80, 400] });
        const finalY = renderTermica(medida as unknown as PdfRenderApi, dadosAtuais);
        const altura = Math.min(Math.max(Math.ceil(finalY + 4), 58), 400);

        const pdf = new jsPDF({ unit: "mm", format: [80, altura] });
        const api = pdf as unknown as PdfRenderApi;
        renderTermica(api, dadosAtuais);
        if (duasVias) {
          pdf.addPage([80, altura]);
          renderTermica(api, dadosAtuais);
        }
        const blob = pdf.output("blob");
        if (seq !== buildPdfSeqRef.current) return;
        publicarPdfGerado(blob, seq);
        return;
      }

      if (formato === "etiquetas") {
        const modeloEtiqueta: ModeloEtiquetaId = modeloEtiquetaValido(modelo)
          ? modelo
          : "slk-54x101";
        const { larguraMm, alturaMm } = dimensoesModeloEtiqueta(modeloEtiqueta);
        const pdf = new jsPDF({ unit: "mm", format: [larguraMm, alturaMm] });
        const api = pdf as unknown as PdfRenderApi;
        await renderEtiquetaOs(api, dadosAtuais, modeloEtiqueta);
        if (duasVias) {
          pdf.addPage([larguraMm, alturaMm]);
          await renderEtiquetaOs(api, dadosAtuais, modeloEtiqueta);
        }
        const blob = pdf.output("blob");
        if (seq !== buildPdfSeqRef.current) return;
        publicarPdfGerado(blob, seq);
        return;
      }

      const layoutModelo2 = normalizarOsModelo2Layout(dadosAtuais.layoutModelo2);
      const layoutModelo3 = normalizarOsModelo3Layout(dadosAtuais.layoutModelo3);
      const pdf = new jsPDF({ unit: "mm", format: criarPdf(formato) });
      const api = pdf as unknown as PdfRenderApi;
      const renderPagina = () => {
        if (modelo === "modelo3") {
          return renderModeloComprovante(api, dadosAtuais, layoutModelo3);
        }
        if (modelo === "modelo2") {
          return renderModeloProducao(api, dadosAtuais, layoutModelo2);
        }
        return renderModeloProducao(api, dadosAtuais, dadosAtuais.layoutModelo1);
      };

      renderPagina();
      if (duasVias) {
        pdf.addPage();
        renderPagina();
      }

      const blob = pdf.output("blob");
      if (seq !== buildPdfSeqRef.current) return;
      publicarPdfGerado(blob, seq);
    }

    void buildPdf().catch((err) => {
      if (seq !== buildPdfSeqRef.current) return;
      console.error("gerar PDF OS", err);
      setErroPdf(
        err instanceof Error
          ? err.message
          : "Não foi possível gerar o PDF da requisição."
      );
    });

    return () => {
      const url = pdfUrlRef.current;
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      pdfUrlRef.current = "";
      pdfBlobRef.current = null;
    };
  }, [configOsPronta, formato, modelo, duasVias, data.numeroOs]);

  function baixarPdf() {
    if (pdfBlobRef.current) {
      baixarPdfBlob(pdfBlobRef.current, nomeArquivoPdf);
      return;
    }
    if (pdfUrl) void baixarPdfUrl(pdfUrl, nomeArquivoPdf);
  }

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
    visualizarPdfUrl(pdfUrl, nomeArquivoPdf, `OS ${data.numeroOs}`, {
      janela,
      revogarAoFechar: false,
    });
  }

  return (
    <div className={PDF_VIEWER_PAGINA_CLASSES}>
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h1 className="text-sm font-semibold">OS {data.numeroOs} — PDF</h1>
          <p className="text-xs text-slate-300">
            {formato === "etiquetas"
              ? `Etiqueta — ${nomeModeloEtiqueta(modeloEtiquetaValido(modelo) ? modelo : "slk-54x101")}`
              : formato === "a4" && modelo === "modelo3"
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
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={baixarPdf}
              >
                <Download className="h-3.5 w-3.5" />
                Baixar
              </Button>
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
        <PdfViewerIframe
          id="pdf-os-viewer"
          title={`OS ${data.numeroOs}`}
          pdfUrl={pdfUrl}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
          Gerando PDF da OS...
        </div>
      )}
    </div>
  );
}
