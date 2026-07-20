import type { ModeloFaturaId } from "@/lib/configuracoes-faturas";
import {
  CONFIG_LAB_PADRAO,
  carregarConfigLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import type { FormatoHtmlPdf } from "@/lib/html-para-pdf";
import type {
  DadosFaturaImpressao,
  LinhaFaturaImpressao,
} from "@/lib/fatura-impressao-html";
import { descontoFaturaImpressaoTotal } from "@/lib/fatura-impressao-html";
import type { FaturaModeloLayout } from "@/lib/fatura-modelo-layout";
import {
  FATURA_SMART_ESPACO_ASSINATURA_PIX_MM,
  FATURA_SMART_ESPACO_OBS_RODAPE_MM,
  FATURA_SMART_ESPACO_RODAPE_MM,
} from "@/lib/fatura-modelo-layout";
import { configParaLabImpressao } from "@/lib/lab-logo";
import { desenharCabecalhoRequisicaoPdf, type PdfCabecalhoApi } from "@/lib/pdf-cabecalho-os";
import { pl } from "@/lib/i18n/print-relatorio-helpers";
import {
  definirLocaleImpressao,
  formatMoneyImpressao,
  resolverLocaleImpressao,
} from "@/lib/i18n/print-i18n";
import {
  hexParaRgb,
  margensLinhaRequisicao,
  posicaoTotaisRequisicaoPdf,
  normalizarCorBorda,
  OS_ASSINATURA_LINHA_PRODUCAO_MM,
  OS_MODELO1_BORDA_MARGEM_MM,
  OS_REQUISICAO_BORDA_EXTERNA_MM,
  OS_REQUISICAO_BORDA_PADDING_MM,
  OS_REQUISICAO_LINHA_DIVISAO_COR,
  OS_REQUISICAO_LINHA_INTERNA_MM,
  OS_REQUISICAO_TOPO_MM,
} from "@/lib/os-modelo1-layout";

type PdfApi = PdfCabecalhoApi & {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  addPage: () => void;
  output: (type: "blob") => Blob;
  setLineWidth: (width: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setFillColor: (r: number, g: number, b: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  getLineHeightFactor?: () => number;
};

function rotuloFatura(chave: Parameters<typeof pl>[0]) {
  return `${pl(chave)}: `;
}

type ColunaFatura = {
  chave: keyof FaturaModeloLayout;
  titulo: string;
  larguraPct: number;
  align?: "left" | "center" | "right";
};

function colunasSmart(): ColunaFatura[] {
  return [
    { chave: "numOs", titulo: pl("print.fatura.col.os"), larguraPct: 5, align: "left" },
    { chave: "qtd", titulo: pl("print.fatura.col.qtd"), larguraPct: 5, align: "center" },
    { chave: "servico", titulo: pl("print.fatura.col.servicos"), larguraPct: 22, align: "left" },
    { chave: "numDente", titulo: pl("print.fatura.col.numDente"), larguraPct: 11, align: "left" },
    { chave: "paciente", titulo: pl("print.fatura.col.paciente"), larguraPct: 13, align: "left" },
    { chave: "valorUnit", titulo: pl("print.fatura.col.unitario"), larguraPct: 13, align: "right" },
    { chave: "desconto", titulo: pl("print.fatura.col.desconto"), larguraPct: 9, align: "right" },
    { chave: "subtotal", titulo: pl("print.fatura.col.subtotal"), larguraPct: 13, align: "right" },
  ];
}

export function faturaSuportaPdfNativo(modelo: ModeloFaturaId, formato: FormatoHtmlPdf) {
  return formato === "a4" && (modelo === "modelo1" || modelo === "modelo2" || modelo === "modelo3");
}

function dataSomenteEmissao(dataEmissao: string) {
  const parte = dataEmissao.trim().split(/\s+/)[0];
  return parte || dataEmissao;
}

function osExternaResumo(linhas: LinhaFaturaImpressao[]) {
  const valores = [
    ...new Set(
      linhas
        .map((l) => (l.osExterna || "").trim())
        .filter((v) => v && v !== "-")
    ),
  ];
  return valores.length ? valores.join(", ") : "—";
}

function labelValue(
  pdf: PdfApi,
  label: string,
  value: string,
  x: number,
  y: number,
  emptyValue = "—"
) {
  pdf.setFont("helvetica", "normal");
  pdf.text(label, x, y);
  pdf.setFont("helvetica", "bold");
  pdf.text(value || emptyValue, x + pdf.getTextWidth(label) + 1.5, y);
  pdf.setFont("helvetica", "normal");
}

function yTopoBordaRequisicaoPdf() {
  return OS_REQUISICAO_TOPO_MM - OS_REQUISICAO_BORDA_PADDING_MM;
}

function linhaRequisicaoPdf(pdf: PdfApi, y: number, pageWidth: number) {
  const { linhaEsq, linhaDir } = margensLinhaRequisicao(pageWidth);
  const h = OS_REQUISICAO_LINHA_INTERNA_MM;
  const { r, g, b } = hexParaRgb(OS_REQUISICAO_LINHA_DIVISAO_COR);
  pdf.setFillColor(r, g, b);
  pdf.rect(linhaEsq, y - h / 2, linhaDir - linhaEsq, h, "F");
}

function linhaSegmentoPdf(pdf: PdfApi, x1: number, y: number, x2: number) {
  const h = OS_REQUISICAO_LINHA_INTERNA_MM;
  const { r, g, b } = hexParaRgb(OS_REQUISICAO_LINHA_DIVISAO_COR);
  pdf.setFillColor(r, g, b);
  pdf.rect(x1, y - h / 2, x2 - x1, h, "F");
}

function desenharBordaRequisicaoPdf(pdf: PdfApi, corHex: string, yFimConteudo: number) {
  const { r, g, b } = hexParaRgb(normalizarCorBorda(corHex));
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

function colunasAtivas(layout: FaturaModeloLayout) {
  return colunasSmart().filter((c) => layout[c.chave]);
}

function largurasColunas(layout: FaturaModeloLayout, larguraTabela: number) {
  const cols = colunasAtivas(layout);
  const totalPct = cols.reduce((s, c) => s + c.larguraPct, 0) || 100;
  let x = 0;
  return cols.map((col) => {
    const w = (col.larguraPct / totalPct) * larguraTabela;
    const item = { ...col, x, w };
    x += w;
    return item;
  });
}

function textoCelula(linha: LinhaFaturaImpressao, col: ColunaFatura) {
  switch (col.chave) {
    case "numOs":
      return linha.os;
    case "qtd":
      return linha.qtd;
    case "servico":
      return linha.servico;
    case "numDente":
      return linha.dentes;
    case "paciente":
      return linha.paciente;
    case "valorUnit":
      return linha.unitario;
    case "desconto":
      return linha.desconto;
    case "subtotal":
      return linha.subtotal;
    default:
      return "";
  }
}

function desenharMetaFaturaCabecalhoDireita(
  pdf: PdfApi,
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  yDir: number,
  dir: number,
  fsSmall: number
) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fsSmall + 8);
  pdf.text(String(dados.numeroFatura), dir, yDir, { align: "right" });
  yDir += 7;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fsSmall);
  if (layout.data) {
    pdf.text(`${pl("print.fatura.data")}: ${dataSomenteEmissao(dados.dataEmissao)}`, dir, yDir, { align: "right" });
    yDir += 4;
  }
  if (layout.usuario) {
    pdf.text(`${pl("print.fatura.usuario")}: ${dados.usuario || "—"}`, dir, yDir, { align: "right" });
    yDir += 4;
  }
  return yDir;
}

function desenharInfoCliente(
  pdf: PdfApi,
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  y: number,
  fsSmall: number,
  saldoAnteriorNosTotais: boolean
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const meio = pageWidth / 2;
  const m = margensLinhaRequisicao(pageWidth);
  let yEsquerda = y;
  let yDireita = y;

  pdf.setFontSize(fsSmall);
  if (layout.cliente) {
    labelValue(pdf, rotuloFatura("print.fatura.cliente"), dados.clienteNome, m.conteudoEsq, yEsquerda);
    yEsquerda += 4.5;
  }
  if (layout.clienteTel) {
    labelValue(pdf, rotuloFatura("print.fatura.telefones"), dados.clienteTelefones || "—", m.conteudoEsq, yEsquerda);
    yEsquerda += 4.5;
  }
  if (layout.ultimoPgto) {
    labelValue(pdf, `${pl("print.fatura.ultimoPgto")}: `, dados.ultimoPgto || "—", m.conteudoEsq, yEsquerda);
    yEsquerda += 4.5;
  }
  if (layout.saldoAnterior && !saldoAnteriorNosTotais) {
    labelValue(pdf, rotuloFatura("print.fatura.saldoAnterior"), dados.saldoAnterior || "R$ 0,00", m.conteudoEsq, yEsquerda);
    yEsquerda += 4.5;
  }

  if (layout.osExterna) {
    labelValue(pdf, rotuloFatura("print.fatura.osExterna"), osExternaResumo(dados.linhas), meio, yDireita);
    yDireita += 4.5;
  }
  if (layout.clienteEmail) {
    labelValue(pdf, rotuloFatura("print.fatura.email"), dados.clienteEmail || "—", meio, yDireita);
    yDireita += 4.5;
  }
  if (layout.clienteEnd) {
    labelValue(pdf, rotuloFatura("print.fatura.endereco"), dados.clienteEndereco || "—", meio, yDireita);
    yDireita += 4.5;
  }

  return Math.max(yEsquerda, yDireita) + 2;
}

function alturaBlocoTextoPdf(pdf: PdfApi, linhas: string | string[], fs: number) {
  const count = Array.isArray(linhas) ? linhas.length : linhas ? 1 : 0;
  if (count <= 0) return 0;
  const lineHeightFactor =
    typeof pdf.getLineHeightFactor === "function" ? pdf.getLineHeightFactor() : 1.15;
  const mmPorLinha = fs * lineHeightFactor * 0.352778;
  return count * mmPorLinha;
}

function desenharLinhaTabela(
  pdf: PdfApi,
  cols: ReturnType<typeof largurasColunas>,
  valores: string[],
  y: number,
  fs: number,
  xBase: number,
  header = false
): number {
  pdf.setFont("helvetica", header ? "bold" : "normal");
  pdf.setFontSize(fs);
  let alturaMax = 0;
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const texto = valores[i] ?? "";
    const x =
      col.align === "right"
        ? xBase + col.x + col.w - 1
        : col.align === "center"
          ? xBase + col.x + col.w / 2
          : xBase + col.x + 1;
    const linhas = pdf.splitTextToSize(texto, Math.max(col.w - 2, 8));
    pdf.text(linhas, x, y, {
      align: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
    });
    alturaMax = Math.max(alturaMax, alturaBlocoTextoPdf(pdf, linhas, fs));
  }
  return alturaMax;
}

function indiceColunaServico(cols: ReturnType<typeof largurasColunas>) {
  return cols.findIndex((c) => c.chave === "servico");
}

function desenharMetaLinhaServico(
  pdf: PdfApi,
  cols: ReturnType<typeof largurasColunas>,
  linha: LinhaFaturaImpressao,
  layout: FaturaModeloLayout,
  y: number,
  fsMeta: number,
  xBase: number
) {
  if (linha.segmento !== "servico") return y;
  if (!layout.data && !layout.finalizado) return y;

  const idxServico = indiceColunaServico(cols);
  if (idxServico < 0) return y;

  const partes: string[] = [];
  if (layout.data) partes.push(`Data: ${linha.dataOs}`);
  if (layout.finalizado) partes.push(`Finalizado: ${linha.finalizado}`);
  const texto = partes.join(" | ");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fsMeta);
  const col = cols[idxServico];
  pdf.text(texto, xBase + col.x + 1, y);
  return y + 4;
}

function desenharTabelaItens(
  pdf: PdfApi,
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  yInicio: number,
  fs: number,
  fsMeta: number
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const m = margensLinhaRequisicao(pageWidth);
  const larguraTabela = m.tabelaDir - m.tabelaEsq;
  const cols = largurasColunas(layout, larguraTabela);
  if (!cols.length) return yInicio;

  let y = yInicio;
  linhaRequisicaoPdf(pdf, y, pageWidth);
  y += 5;
  const alturaCabecalho = desenharLinhaTabela(
    pdf,
    cols,
    cols.map((c) => c.titulo),
    y,
    fs - 1,
    m.tabelaEsq,
    true
  );
  y += Math.max(alturaCabecalho, 4) + 1;
  linhaRequisicaoPdf(pdf, y, pageWidth);
  y += 4;

  let osAnterior = "";
  for (const linha of dados.linhas) {
    if (y > pageHeight - 35) {
      pdf.addPage();
      y = OS_REQUISICAO_TOPO_MM + 8;
    }

    const novaOs = linha.os !== osAnterior;
    osAnterior = linha.os;
    const valores = cols.map((col) => {
      if (col.chave === "numOs" && !novaOs) return "";
      return textoCelula(linha, col);
    });

    const alturaLinha = desenharLinhaTabela(pdf, cols, valores, y, fs - 1, m.tabelaEsq);
    y += Math.max(alturaLinha, 3.5) + 0.6;
    y = desenharMetaLinhaServico(pdf, cols, linha, layout, y, fsMeta, m.tabelaEsq);
    y += 1.2;
  }

  linhaRequisicaoPdf(pdf, y, pageWidth);
  return y + 4;
}

function formatarMoedaPdf(valor: number) {
  return formatMoneyImpressao(valor);
}

function desenharTotais(
  pdf: PdfApi,
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  modelo: ModeloFaturaId,
  y: number,
  fsSmall: number
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const { xRotulo, xValor } = posicaoTotaisRequisicaoPdf(pageWidth);
  let cursor = y;

  pdf.setFontSize(fsSmall);
  const linhaTotal = (rotulo: string, valor: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.text(rotulo, xRotulo, cursor);
    pdf.text(valor, xValor, cursor, { align: "right" });
    cursor += 4.5;
  };

  if (layout.totalServicos) {
    const rotulo =
      modelo === "modelo2"
        ? pl("print.fatura.totalServicosProdutos")
        : modelo === "modelo3"
          ? pl("print.fatura.totalServicosIgual")
          : pl("print.fatura.totalServicos");
    linhaTotal(rotulo, formatarMoedaPdf(dados.totalServicos));
  }
  if (modelo === "modelo3" && layout.saldoAnterior) {
    linhaTotal(pl("print.fatura.saldoAnteriorMais"), dados.saldoAnterior || "R$ 0,00");
  }
  if (layout.descontoServicos) {
    linhaTotal(
      pl("print.fatura.descontoServicos"),
      formatarMoedaPdf(dados.descontoServicos ?? 0)
    );
  }
  if (layout.descontoFatura) {
    linhaTotal(
      pl("print.fatura.descontoFatura"),
      formatarMoedaPdf(descontoFaturaImpressaoTotal(dados))
    );
  }
  if (modelo === "modelo2") {
    linhaTotal(pl("print.fatura.jurosFatura"), "R$ 0,00");
  }
  if (layout.total) {
    linhaTotal(pl("print.fatura.total"), formatarMoedaPdf(dados.totalFinal), true);
  }

  return cursor + 2;
}

function desenharCondicaoPagamento(
  pdf: PdfApi,
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  y: number,
  fsSmall: number
) {
  if (!layout.condicaoPagamento || !dados.parcelas.length) return y;

  const pageWidth = pdf.internal.pageSize.getWidth();
  const m = margensLinhaRequisicao(pageWidth);
  const larguraTabela = m.tabelaDir - m.tabelaEsq;
  const corPago = hexParaRgb("#5cb85c");

  function parcelaRecebidaPdf(parcela: DadosFaturaImpressao["parcelas"][number]) {
    return Boolean(parcela.recebida);
  }

  let cursor = y + 4;
  linhaRequisicaoPdf(pdf, cursor, pageWidth);
  cursor += 5;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fsSmall);
  pdf.text(pl("print.fatura.condicaoPagamento"), m.conteudoEsq, cursor);
  cursor += 5;

  const cols = [
    { titulo: pl("print.fatura.col.parcela"), w: larguraTabela * 0.18, align: "left" as const },
    { titulo: pl("print.fatura.col.vencimento"), w: larguraTabela * 0.18, align: "left" as const },
    ...(layout.formaPgto
      ? [{ titulo: pl("print.fatura.col.formaPagto"), w: larguraTabela * 0.26, align: "left" as const }]
      : []),
    { titulo: pl("print.fatura.col.valor"), w: larguraTabela * 0.19, align: "right" as const },
    { titulo: pl("print.fatura.col.pago"), w: larguraTabela * 0.19, align: "right" as const },
  ];

  let x = m.tabelaEsq;
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);
  for (const col of cols) {
    pdf.text(col.titulo, col.align === "right" ? x + col.w - 1 : x + 1, cursor, {
      align: col.align,
    });
    x += col.w;
  }
  cursor += 4;
  linhaRequisicaoPdf(pdf, cursor, pageWidth);
  cursor += 4;

  pdf.setFont("helvetica", "normal");
  const lineHeight = 4.2;
  for (const parcela of dados.parcelas) {
    const valores = [
      parcela.parcela,
      parcela.vencimento,
      ...(layout.formaPgto ? [parcela.forma] : []),
      parcela.valor.replace(/^R\$\s*/i, ""),
      parcela.pago.replace(/^R\$\s*/i, ""),
    ];
    const linhasPorColuna = cols.map((col, i) =>
      pdf.splitTextToSize(valores[i] || "", Math.max(col.w - 2, 8))
    );
    const alturaLinha = Math.max(
      lineHeight,
      ...linhasPorColuna.map((linhas) => linhas.length * lineHeight)
    );
    const recebida = parcelaRecebidaPdf(parcela);
    const restante = Boolean(parcela.restante);

    x = m.tabelaEsq;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const linhas = linhasPorColuna[i];
      if (recebida) {
        pdf.setTextColor(corPago.r, corPago.g, corPago.b);
        pdf.setFont("helvetica", col.titulo === pl("print.fatura.col.pago") ? "bold" : "normal");
      } else if (restante) {
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "bold");
      } else {
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");
      }
      let yTexto = cursor;
      for (const linha of linhas) {
        pdf.text(linha, col.align === "right" ? x + col.w - 1 : x + 1, yTexto, {
          align: col.align,
        });
        yTexto += lineHeight;
      }
      x += col.w;
    }
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal");
    cursor += alturaLinha + 1.2;
  }

  linhaRequisicaoPdf(pdf, cursor, pageWidth);
  return cursor + 4;
}

function desenharRodape(
  pdf: PdfApi,
  dados: DadosFaturaImpressao,
  layout: FaturaModeloLayout,
  y: number,
  fsSmall: number
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  let cursor = y;

  if (layout.observacao) {
    cursor += FATURA_SMART_ESPACO_OBS_RODAPE_MM * 0.15;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fsSmall);
    pdf.text(`${pl("print.fatura.observacao")}: ${dados.observacao || ""}`, margensLinhaRequisicao(pageWidth).conteudoEsq, cursor);
    cursor += 6;
  }

  if (layout.mensagem?.trim()) {
    pdf.setFont("helvetica", "italic");
    pdf.text(layout.mensagem.trim(), pageWidth / 2, cursor, { align: "center" });
    pdf.setFont("helvetica", "normal");
    cursor += 6;
  }

  if (layout.assinatura) {
    cursor += FATURA_SMART_ESPACO_RODAPE_MM * 0.2;
    const largura = OS_ASSINATURA_LINHA_PRODUCAO_MM;
    const xLinha = (pageWidth - largura) / 2;
    linhaSegmentoPdf(pdf, xLinha, cursor, xLinha + largura);
    pdf.setFontSize(Math.max(8, fsSmall - 1));
    pdf.text(pl("print.fatura.assinatura"), pageWidth / 2, cursor + 4, {
      align: "center",
    });
    cursor += 10;
  }

  if (layout.pix && layout.pixQrImagem?.startsWith("data:image")) {
    cursor += layout.assinatura ? FATURA_SMART_ESPACO_ASSINATURA_PIX_MM * 0.15 : 2;
    const tamanhoMm = Math.min(22, layout.pixQrTamanhoPx * 0.264583);
    const xQr = margensLinhaRequisicao(pageWidth).conteudoEsq;
    try {
      const fmt = layout.pixQrImagem.toLowerCase().includes("png") ? "PNG" : "JPEG";
      pdf.addImage(layout.pixQrImagem, fmt, xQr, cursor - tamanhoMm + 2, tamanhoMm, tamanhoMm);
      pdf.setFontSize(layout.pixQrFonte * 0.75);
      pdf.text(pl("print.fatura.pagarPix"), xQr + tamanhoMm + 3, cursor);
    } catch {
      /* ignore */
    }
    cursor += 4;
  }

  return cursor;
}

function renderFaturaA4SmartPdf(
  pdf: PdfApi,
  dados: DadosFaturaImpressao,
  cfgLab: ConfigLaboratorio,
  layout: FaturaModeloLayout,
  modelo: ModeloFaturaId
) {
  const lab = configParaLabImpressao(cfgLab);
  const fs = layout.tamanhoFonte;
  const fsSmall = Math.max(11, fs - 1);
  const fsMeta = Math.max(9, fs - 2);
  const saldoAnteriorNosTotais = modelo === "modelo3" && layout.saldoAnterior;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const m = margensLinhaRequisicao(pageWidth);

  let y = desenharCabecalhoRequisicaoPdf(pdf, {
    lab,
    configLab: cfgLab,
    tituloDireita: pl("print.fatura.titulo"),
    exibirLogo: layout.logo,
    exibirInfoLab: layout.infoLab,
    linhaEsq: m.linhaEsq,
    linhaDir: m.linhaDir,
    extrasDireita: (yDir, _margin, dir) =>
      desenharMetaFaturaCabecalhoDireita(pdf, dados, layout, yDir, dir, fsSmall),
  });

  linhaRequisicaoPdf(pdf, y, pageWidth);
  y += 5;

  y = desenharInfoCliente(pdf, dados, layout, y, fsSmall, Boolean(saldoAnteriorNosTotais));
  y = desenharTabelaItens(pdf, dados, layout, y, fs, fsMeta);
  y = desenharTotais(pdf, dados, layout, modelo, y, fsSmall);
  y = desenharCondicaoPagamento(pdf, dados, layout, y, fsSmall);
  y = desenharRodape(pdf, dados, layout, y, fsSmall);

  if (layout.exibirBordas) {
    desenharBordaRequisicaoPdf(pdf, layout.bordas, y);
  }
}

/** PDF nativo (jsPDF) — mesma base da ordem de serviço. */
export async function gerarPdfFaturaImpressao(opts: {
  dados: DadosFaturaImpressao;
  cfgLab: ConfigLaboratorio;
  layout: FaturaModeloLayout;
  modelo: ModeloFaturaId;
}): Promise<Blob> {
  const cfgLab =
    opts.cfgLab ??
    (typeof window !== "undefined" ? carregarConfigLaboratorio() : CONFIG_LAB_PADRAO);
  definirLocaleImpressao(resolverLocaleImpressao({ configLab: cfgLab }));
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  renderFaturaA4SmartPdf(
    pdf as unknown as PdfApi,
    opts.dados,
    cfgLab,
    opts.layout,
    opts.modelo
  );
  return pdf.output("blob");
}
