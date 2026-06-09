import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";
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

const CINZA_CLIENTE: [number, number, number] = [242, 242, 242];
const AZUL_RECEBIMENTO: [number, number, number] = [230, 247, 255];

const TITULO = "Relatório de Parcelas Recebidas - (Data Recebimento)";

const COLUNAS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Fatura", larguraMm: 61, align: "center" },
  { titulo: "Vencimento", larguraMm: 61, align: "center" },
  { titulo: "Valor", larguraMm: 60, align: "right" },
];

type OpcoesCompleto = OpcoesPeriodoRelatorioFaturas & {
  periodoAtivo?: boolean;
  ordenarPor?: string;
};

type GrupoCliente = {
  cliente: string;
  linhas: LinhaRelatorioContasReceber[];
};

function moneyRs(value: number) {
  return `R$ ${moneyBr(value)}`;
}

function larguraConteudo(ctx: ContextoTabelaFaturasSmart) {
  return ctx.pageW - ctx.margin * 2;
}

function novaPaginaSePreciso(ctx: ContextoTabelaFaturasSmart, altura: number) {
  if (ctx.y + altura > ctx.pageH - ctx.margin - 10) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
  }
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

function desenharCabecalhoPagina(ctx: ContextoTabelaFaturasSmart) {
  ctx.y = desenharCabecalhoLabRelatorioPdf(ctx.api, ctx.margin, ctx.y);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(TITULO, ctx.pageW / 2, ctx.y, { align: "center" });
  ctx.y += 10;
}

function desenharBarraCliente(ctx: ContextoTabelaFaturasSmart, cliente: string) {
  const largura = larguraConteudo(ctx);
  const altura = ctx.headerH;
  novaPaginaTabelaFaturasSmart(ctx, altura + 20);
  ctx.pdf.setFillColor(...CINZA_CLIENTE);
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

function textoBarraRecebimento(linha: LinhaRelatorioContasReceber) {
  const data = linha.dataRecebimento ?? linha.vencimento;
  const forma =
    linha.formaRecebimento && linha.formaRecebimento !== "—"
      ? linha.formaRecebimento
      : "";
  return `Data Recebimento: ${data}   |   Forma: ${forma}   |   Valor: ${moneyRs(linha.valor)}`;
}

function desenharBarraRecebimento(ctx: ContextoTabelaFaturasSmart, linha: LinhaRelatorioContasReceber) {
  const largura = larguraConteudo(ctx);
  const altura = ctx.headerH;
  novaPaginaSePreciso(ctx, altura + ctx.headerH + ctx.rowH + 14);
  ctx.pdf.setFillColor(...AZUL_RECEBIMENTO);
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.rect(ctx.margin, ctx.y, largura, altura, "FD");
  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.setFontSize(8.5);
  ctx.pdf.setTextColor(...PRETO);
  const texto = textoBarraRecebimento(linha);
  const linhasTxt = ctx.pdf.splitTextToSize(texto, largura - 4);
  const offsetY =
    linhasTxt.length === 1
      ? altura / 2 + 1.2
      : 3.8 + ((linhasTxt.length - 1) * 3.4) / 2;
  ctx.pdf.text(linhasTxt, ctx.margin + 2, ctx.y + offsetY);
  ctx.y += Math.max(altura, linhasTxt.length * 3.4 + 2.5);
}

function desenharTabelaFaturaRecebimento(
  ctx: ContextoTabelaFaturasSmart,
  linha: LinhaRelatorioContasReceber
) {
  desenharLinhaTabelaFaturasSmart(
    ctx,
    COLUNAS.map((c) => c.titulo),
    { header: true, fillHeader: true }
  );

  novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
  desenharLinhaTabelaFaturasSmart(ctx, [
    String(linha.numeroFatura),
    linha.vencimento,
    moneyBr(linha.valor),
  ]);
}

function desenharSubtotalRecebimento(ctx: ContextoTabelaFaturasSmart, valor: number) {
  ctx.y += 2;
  novaPaginaSePreciso(ctx, 8);
  const x = ctx.margin;
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text("Subtotal:", x, ctx.y + 3.5);
  const labelW = ctx.pdf.getTextWidth("Subtotal:");
  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.text(` ${moneyRs(valor)}`, x + labelW, ctx.y + 3.5);
  ctx.y += 7;
}

function desenharBlocoRecebimento(
  ctx: ContextoTabelaFaturasSmart,
  linha: LinhaRelatorioContasReceber
) {
  desenharBarraRecebimento(ctx, linha);
  desenharTabelaFaturaRecebimento(ctx, linha);
  desenharSubtotalRecebimento(ctx, linha.valor);
  ctx.y += 2;
}

function desenharGrupoCliente(ctx: ContextoTabelaFaturasSmart, grupo: GrupoCliente) {
  desenharBarraCliente(ctx, grupo.cliente);
  for (const linha of grupo.linhas) {
    desenharBlocoRecebimento(ctx, linha);
  }
  ctx.y += 2;
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

/** Layout Smart Prótese — Recebimentos (completo). */
export async function gerarRelatorioRecebimentosCompletoSmartPdf(
  linhas: LinhaRelatorioContasReceber[],
  _opcoes: OpcoesCompleto
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf, COLUNAS);
  const grupos = agruparPorCliente(linhas);
  const totalGeral = linhas.reduce((s, l) => s + l.valor, 0);

  desenharCabecalhoPagina(ctx);

  if (grupos.length === 0) {
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setFontSize(10);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text("Nenhuma parcela recebida no período.", ctx.margin, ctx.y);
  } else {
    for (const grupo of grupos) {
      desenharGrupoCliente(ctx, grupo);
    }
  }

  desenharTotalRecebido(ctx, totalGeral);

  return pdf.output("blob");
}
