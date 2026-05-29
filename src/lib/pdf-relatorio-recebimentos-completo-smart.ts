import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";
import { desenharCabecalhoRecebimentosSmart } from "@/lib/pdf-relatorio-recebimentos-smart";
import {
  moneyBr,
  PRETO,
  type ColunaRelatorioFaturasSmart,
  type OpcoesPeriodoRelatorioFaturas,
} from "@/lib/pdf-relatorio-faturas-smart-comum";
import type { jsPDF } from "jspdf";

const AZUL_BARRA: [number, number, number] = [230, 240, 248];
const CINZA_ZEBRA: [number, number, number] = [249, 249, 249];
const CINZA_HEADER: [number, number, number] = [245, 245, 245];

const COLUNAS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Data Venc.", larguraMm: 20, align: "center" },
  { titulo: "Data Receb.", larguraMm: 20, align: "center" },
  { titulo: "Cliente / Descrição", larguraMm: 44, align: "left" },
  { titulo: "Forma Pagto.", larguraMm: 26, align: "left" },
  { titulo: "Valor", larguraMm: 22, align: "right" },
  { titulo: "Juros", larguraMm: 20, align: "right" },
  { titulo: "Total", larguraMm: 22, align: "right" },
];

const COL_RESUMO: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Forma Pagto.", larguraMm: 90, align: "left" },
  { titulo: "Qtd", larguraMm: 22, align: "center" },
  { titulo: "Valor", larguraMm: 62, align: "right" },
];

type PdfApi = Parameters<typeof desenharCabecalhoRecebimentosSmart>[0];

type Ctx = {
  pdf: jsPDF;
  api: PdfApi;
  margin: number;
  pageW: number;
  pageH: number;
  colunas: ColunaRelatorioFaturasSmart[];
  colX: number[];
  y: number;
  rowH: number;
  headerH: number;
  grupoAtual: string | null;
};

type GrupoDentista = {
  cliente: string;
  linhas: LinhaRelatorioContasReceber[];
};

type OpcoesCompleto = OpcoesPeriodoRelatorioFaturas & {
  periodoAtivo?: boolean;
  ordenarPor?: string;
};

function moneyCell(value: number) {
  return moneyBr(value);
}

function labelOrdenar(ordenarPor?: string) {
  const map: Record<string, string> = {
    data_lancamento: "DATA RECEBIMENTO",
    vencimento: "DATA VENCIMENTO",
    cliente: "CLIENTE",
    valor: "VALOR",
    fatura: "FATURA",
  };
  return map[ordenarPor ?? "data_lancamento"] ?? "DATA RECEBIMENTO";
}

function agruparPorDentista(linhas: LinhaRelatorioContasReceber[]): GrupoDentista[] {
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

function criarCtx(pdf: jsPDF, colunas: ColunaRelatorioFaturasSmart[]): Ctx {
  const margin = 14;
  const colX: number[] = [margin];
  for (let i = 0; i < colunas.length - 1; i++) {
    colX.push(colX[i] + colunas[i].larguraMm);
  }
  return {
    pdf,
    api: pdf as unknown as PdfApi,
    margin,
    pageW: pdf.internal.pageSize.getWidth(),
    pageH: pdf.internal.pageSize.getHeight(),
    colunas,
    colX,
    y: margin,
    rowH: 6,
    headerH: 6.8,
    grupoAtual: null,
  };
}

function larguraTabela(ctx: Ctx) {
  const i = ctx.colunas.length - 1;
  return ctx.colX[i] + ctx.colunas[i].larguraMm - ctx.margin;
}

function novaPagina(ctx: Ctx, altura: number, redesenharGrupo = false) {
  if (ctx.y + altura > ctx.pageH - ctx.margin - 16) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
    if (redesenharGrupo && ctx.grupoAtual) {
      desenharBarraDentista(ctx, ctx.grupoAtual);
      desenharCabecalhoColunas(ctx);
    }
  }
}

function desenharCelula(
  ctx: Ctx,
  colIndex: number,
  texto: string,
  altura: number,
  opts?: { header?: boolean; zebra?: boolean; bold?: boolean }
) {
  const col = ctx.colunas[colIndex];
  const x = ctx.colX[colIndex];
  const w = col.larguraMm;
  ctx.pdf.setDrawColor(221, 221, 221);
  ctx.pdf.setLineWidth(0.2);
  if (opts?.header) {
    ctx.pdf.setFillColor(...CINZA_HEADER);
    ctx.pdf.rect(x, ctx.y, w, altura, "FD");
  } else if (opts?.zebra) {
    ctx.pdf.setFillColor(...CINZA_ZEBRA);
    ctx.pdf.rect(x, ctx.y, w, altura, "FD");
  } else {
    ctx.pdf.rect(x, ctx.y, w, altura);
  }
  ctx.pdf.setFont("helvetica", opts?.header || opts?.bold ? "bold" : "normal");
  ctx.pdf.setFontSize(opts?.header ? 8 : 8);
  ctx.pdf.setTextColor(...PRETO);
  const pad = 1.5;
  const truncado = ctx.pdf.splitTextToSize(texto, w - pad * 2)[0] || texto;
  const tx =
    col.align === "right"
      ? x + w - pad
      : col.align === "center"
        ? x + w / 2
        : x + pad;
  ctx.pdf.text(truncado, tx, ctx.y + altura / 2 + 1.1, { align: col.align });
}

function desenharLinha(
  ctx: Ctx,
  valores: string[],
  opts?: { header?: boolean; zebra?: boolean; bold?: boolean }
) {
  const altura = opts?.header ? ctx.headerH : ctx.rowH;
  ctx.colunas.forEach((_, i) => {
    desenharCelula(ctx, i, valores[i] ?? "", altura, opts);
  });
  ctx.y += altura;
}

function desenharTituloEFiltros(ctx: Ctx, opcoes: OpcoesCompleto) {
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text("Relatório de Receitas - Parcelas Recebidas", ctx.pageW / 2, ctx.y, {
    align: "center",
  });
  ctx.y += 7;

  const periodo =
    opcoes.periodoAtivo !== false && opcoes.dataInicio && opcoes.dataFinal
      ? `${opcoes.dataInicio} - ${opcoes.dataFinal}`
      : "Todos";
  const filtros = [
    `PERÍODO: ${periodo}`,
    `ORDENAR POR: ${labelOrdenar(opcoes.ordenarPor)}`,
    "FINANCEIRO: SIM",
  ].join("   |   ");

  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.setFontSize(8);
  ctx.pdf.text(filtros, ctx.margin, ctx.y);
  ctx.y += 5;

  ctx.pdf.setDrawColor(200, 200, 200);
  ctx.pdf.setLineWidth(0.35);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  ctx.y += 7;
}

function desenharBarraDentista(ctx: Ctx, nome: string) {
  const altura = 7;
  novaPagina(ctx, altura + ctx.headerH + ctx.rowH * 2, false);
  const largura = larguraTabela(ctx);
  ctx.pdf.setFillColor(...AZUL_BARRA);
  ctx.pdf.setDrawColor(200, 210, 220);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.rect(ctx.margin, ctx.y, largura, altura, "FD");
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(8.5);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(`DENTISTA: ${nome.toUpperCase()}`, ctx.margin + 2.5, ctx.y + altura / 2 + 1.2);
  ctx.y += altura;
  ctx.grupoAtual = nome;
}

function desenharCabecalhoColunas(ctx: Ctx) {
  desenharLinha(
    ctx,
    ctx.colunas.map((c) => c.titulo),
    { header: true }
  );
}

function desenharSubtotalDentista(ctx: Ctx, linhas: LinhaRelatorioContasReceber[]) {
  const totalValor = linhas.reduce((s, l) => s + (l.valorBase ?? l.valor), 0);
  const totalJuros = linhas.reduce((s, l) => s + (l.juros ?? 0), 0);
  const totalGeral = linhas.reduce((s, l) => s + l.valor, 0);
  novaPagina(ctx, ctx.rowH, true);
  desenharLinha(
    ctx,
    [
      "",
      "",
      "Total do Cliente:",
      "",
      moneyCell(totalValor),
      moneyCell(totalJuros),
      moneyCell(totalGeral),
    ],
    { bold: true }
  );
}

function desenharBlocoDentista(ctx: Ctx, grupo: GrupoDentista) {
  ctx.grupoAtual = null;
  desenharBarraDentista(ctx, grupo.cliente);
  desenharCabecalhoColunas(ctx);

  grupo.linhas.forEach((linha, idx) => {
    novaPagina(ctx, ctx.rowH, true);
    const valorBase = linha.valorBase ?? linha.valor;
    const juros = linha.juros ?? 0;
    desenharLinha(
      ctx,
      [
        linha.vencimento,
        linha.dataRecebimento ?? linha.vencimento,
        linha.descricaoLinha ?? linha.os,
        linha.formaRecebimento,
        moneyCell(valorBase),
        moneyCell(juros),
        moneyCell(linha.valor),
      ],
      { zebra: idx % 2 === 1 }
    );
  });

  desenharSubtotalDentista(ctx, grupo.linhas);
  ctx.y += 4;
  ctx.grupoAtual = null;
}

function aplicarColunas(ctx: Ctx, colunas: ColunaRelatorioFaturasSmart[]) {
  ctx.colunas = colunas;
  ctx.colX = [ctx.margin];
  for (let i = 0; i < colunas.length - 1; i++) {
    ctx.colX.push(ctx.colX[i] + colunas[i].larguraMm);
  }
}

function desenharResumoTabela(
  ctx: Ctx,
  titulo: string,
  colunas: ColunaRelatorioFaturasSmart[],
  linhas: [string, string, string][]
) {
  ctx.y += 6;
  novaPagina(ctx, ctx.headerH + ctx.rowH * (linhas.length + 3), false);

  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(9.5);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(titulo, ctx.margin, ctx.y);
  ctx.y += 5;

  const colsAnterior = ctx.colunas;
  const colXAnterior = [...ctx.colX];
  aplicarColunas(ctx, colunas);

  desenharLinha(
    ctx,
    colunas.map((c) => c.titulo),
    { header: true }
  );

  for (const valores of linhas) {
    novaPagina(ctx, ctx.rowH, false);
    desenharLinha(ctx, valores);
  }

  ctx.colunas = colsAnterior;
  ctx.colX = colXAnterior;
}

function totaisPorForma(linhas: LinhaRelatorioContasReceber[]) {
  const mapa = new Map<string, { qtd: number; valor: number }>();
  for (const linha of linhas) {
    const forma = (linha.formaRecebimento || "—").trim();
    const atual = mapa.get(forma) ?? { qtd: 0, valor: 0 };
    atual.qtd += 1;
    atual.valor += linha.valor;
    mapa.set(forma, atual);
  }
  return Array.from(mapa.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR")
  );
}

function totaisPorCategoria(linhas: LinhaRelatorioContasReceber[]) {
  const mapa = new Map<string, { qtd: number; valor: number }>();
  for (const linha of linhas) {
    const cat = (linha.categoria || "Receitas de Serviços").trim();
    const atual = mapa.get(cat) ?? { qtd: 0, valor: 0 };
    atual.qtd += 1;
    atual.valor += linha.valor;
    mapa.set(cat, atual);
  }
  return Array.from(mapa.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR")
  );
}

function desenharTotalGeral(ctx: Ctx, total: number) {
  ctx.y += 8;
  novaPagina(ctx, 14, false);
  const largura = larguraTabela(ctx);
  ctx.pdf.setFillColor(...AZUL_BARRA);
  ctx.pdf.setDrawColor(180, 195, 210);
  ctx.pdf.rect(ctx.margin, ctx.y, largura, 9, "FD");
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(11);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text("TOTAL GERAL:", ctx.margin + 3, ctx.y + 6);
  ctx.pdf.text(moneyCell(total), ctx.margin + largura - 3, ctx.y + 6, {
    align: "right",
  });
  ctx.y += 12;
}

/** Layout Smart — Recebimentos (completo). */
export async function gerarRelatorioRecebimentosCompletoSmartPdf(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesCompleto
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarCtx(pdf, COLUNAS);
  const grupos = agruparPorDentista(linhas);
  const totalGeral = linhas.reduce((s, l) => s + l.valor, 0);

  ctx.y = desenharCabecalhoRecebimentosSmart(ctx.api, ctx.margin, ctx.margin);
  desenharTituloEFiltros(ctx, opcoes);

  if (grupos.length === 0) {
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(10);
    ctx.pdf.text("Nenhuma parcela recebida no período.", ctx.margin, ctx.y);
    ctx.y += 8;
    desenharTotalGeral(ctx, 0);
  } else {
    for (const grupo of grupos) {
      desenharBlocoDentista(ctx, grupo);
    }

    const porForma = totaisPorForma(linhas);
    desenharResumoTabela(
      ctx,
      "RESUMO POR FORMA DE PAGAMENTO",
      COL_RESUMO,
      porForma.map(([forma, { qtd, valor }]) => [
        forma,
        String(qtd),
        moneyCell(valor),
      ])
    );

    const porCategoria = totaisPorCategoria(linhas);
    const colCat: ColunaRelatorioFaturasSmart[] = [
      { titulo: "Categoria", larguraMm: 90, align: "left" },
      { titulo: "Qtd", larguraMm: 22, align: "center" },
      { titulo: "Valor", larguraMm: 62, align: "right" },
    ];
    desenharResumoTabela(
      ctx,
      "RESUMO POR CATEGORIA",
      colCat,
      porCategoria.map(([cat, { qtd, valor }]) => [
        cat,
        String(qtd),
        moneyCell(valor),
      ])
    );

    desenharTotalGeral(ctx, totalGeral);
  }

  const totalPaginas = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    pdf.setPage(p);
    const yRodape = ctx.pageH - 8;
    const agora = new Date();
    const dataHora = agora.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Gerado em ${dataHora}`, ctx.margin, yRodape);
    pdf.text(`Página ${p} de ${totalPaginas}`, ctx.pageW - ctx.margin, yRodape, {
      align: "right",
    });
  }

  return pdf.output("blob");
}
