import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import {
  criarContextoTabelaFaturasSmart,
  desenharLinhaTabelaFaturasSmart,
  moneyBr,
  novaPaginaTabelaFaturasSmart,
  tituloPeriodoSmart,
  type ColunaRelatorioFaturasSmart,
  type ContextoTabelaFaturasSmart,
  type OpcoesPeriodoRelatorioFaturas,
  PRETO,
} from "@/lib/pdf-relatorio-faturas-smart-comum";

const CINZA_FUNDO: [number, number, number] = [238, 238, 238];

const COLUNAS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Núm Fatura", larguraMm: 16, align: "center" },
  { titulo: "Parcela", larguraMm: 14, align: "center" },
  { titulo: "Vencimento", larguraMm: 22, align: "center" },
  { titulo: "Forma Pagamento", larguraMm: 54, align: "left" },
  { titulo: "Valor", larguraMm: 20, align: "right" },
  { titulo: "Juros", larguraMm: 16, align: "right" },
  { titulo: "Recebido", larguraMm: 20, align: "right" },
  { titulo: "Saldo", larguraMm: 20, align: "right" },
];

export type OpcoesRelatorioParcelasAReceberModelo2 = OpcoesPeriodoRelatorioFaturas & {
  somenteAReceber?: boolean;
  agruparPorCliente?: boolean;
};

function moneyRs(value: number) {
  return `R$ ${moneyBr(value)}`;
}

function formatarParcelaLabel(parcela: string) {
  const match = parcela.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return parcela.trim() || "1/1";
  return `${match[1]}/${match[2]}`;
}

function formaPagamentoLinha(linha: LinhaRelatorioContasReceber) {
  return linha.formaRecebimento && linha.formaRecebimento !== "—"
    ? linha.formaRecebimento
    : "";
}

function linhasFiltradas(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesRelatorioParcelasAReceberModelo2
) {
  if (opcoes.somenteAReceber === false) return linhas;
  return linhas.filter((linha) => linha.saldo > 0.009);
}

function agruparLinhasPorCliente(linhas: LinhaRelatorioContasReceber[]) {
  const mapa = new Map<string, LinhaRelatorioContasReceber[]>();
  for (const linha of linhas) {
    const chave = linha.cliente.trim() || "Sem cliente informado";
    const lista = mapa.get(chave) ?? [];
    lista.push(linha);
    mapa.set(chave, lista);
  }
  return Array.from(mapa.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR")
  );
}

function desenharCabecalhoPagina(ctx: ContextoTabelaFaturasSmart, titulo: string) {
  ctx.y = desenharCabecalhoLabRelatorioPdf(ctx.api, ctx.margin, ctx.y);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(titulo, ctx.pageW / 2, ctx.y, { align: "center" });
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
  ctx.pdf.text(cliente, ctx.margin + 2, ctx.y + altura / 2 + 1.2);
  ctx.y += altura;
}

function valoresLinhaParcela(linha: LinhaRelatorioContasReceber) {
  return [
    String(linha.numeroFatura),
    formatarParcelaLabel(linha.parcela),
    linha.vencimento,
    formaPagamentoLinha(linha),
    moneyBr(linha.valor),
    moneyBr(linha.juros ?? 0),
    moneyBr(linha.recebido),
    moneyBr(linha.saldo),
  ];
}

function desenharLinhaTotalGrupo(
  ctx: ContextoTabelaFaturasSmart,
  totalValor: number,
  totalJuros: number,
  totalRecebido: number,
  totalSaldo: number
) {
  const altura = ctx.rowH;
  novaPaginaTabelaFaturasSmart(ctx, altura);
  const valores = [
    "",
    "",
    "",
    "Total",
    moneyRs(totalValor),
    moneyRs(totalJuros),
    moneyRs(totalRecebido),
    moneyRs(totalSaldo),
  ];

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

function desenharTabelaParcelas(
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
    desenharLinhaTabelaFaturasSmart(ctx, valoresLinhaParcela(linha));
  }

  const totalValor = linhasGrupo.reduce((s, l) => s + l.valor, 0);
  const totalJuros = linhasGrupo.reduce((s, l) => s + (l.juros ?? 0), 0);
  const totalRecebido = linhasGrupo.reduce((s, l) => s + l.recebido, 0);
  const totalSaldo = linhasGrupo.reduce((s, l) => s + l.saldo, 0);

  desenharLinhaTotalGrupo(ctx, totalValor, totalJuros, totalRecebido, totalSaldo);
  ctx.y += 4;
}

function desenharTotalGeralEsquerda(ctx: ContextoTabelaFaturasSmart, totalSaldo: number) {
  ctx.y += 2;
  if (ctx.y + 14 > ctx.pageH - ctx.margin) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
  }
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text("TOTAL A RECEBER FATURAS", ctx.margin, ctx.y + 4);
  ctx.y += 6;
  ctx.pdf.setFontSize(10);
  ctx.pdf.text(moneyRs(totalSaldo), ctx.margin, ctx.y + 4);
  ctx.y += 8;
}

export async function gerarRelatorioParcelasAReceberModelo2Pdf(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesRelatorioParcelasAReceberModelo2
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf, COLUNAS);

  const titulo = `Relatório de Parcelas a Receber - (${tituloPeriodoSmart(opcoes.periodoCampo)})`;
  desenharCabecalhoPagina(ctx, titulo);

  const filtradas = linhasFiltradas(linhas, opcoes);
  const agruparCliente = opcoes.agruparPorCliente !== false;
  const totalAReceber = filtradas.reduce((s, l) => s + l.saldo, 0);

  if (filtradas.length === 0) {
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setFontSize(10);
    ctx.pdf.text("Nenhuma parcela no período.", ctx.margin, ctx.y);
  } else if (agruparCliente) {
    for (const [cliente, linhasCliente] of agruparLinhasPorCliente(filtradas)) {
      desenharTabelaParcelas(ctx, linhasCliente, { barraCliente: cliente });
    }
  } else {
    desenharTabelaParcelas(ctx, filtradas);
  }

  desenharTotalGeralEsquerda(ctx, totalAReceber);

  return pdf.output("blob");
}
