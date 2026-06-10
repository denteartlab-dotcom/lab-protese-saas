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

export type OpcoesRelatorioParcelasAReceberModelo1 = OpcoesPeriodoRelatorioFaturas & {
  somenteAReceber?: boolean;
};

function linhasFiltradas(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesRelatorioParcelasAReceberModelo1
) {
  if (opcoes.somenteAReceber === false) return linhas;
  return linhas.filter((linha) => linha.saldo > 0.009);
}

const COLUNAS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Cliente", larguraMm: 78, align: "left" },
  { titulo: "Valor a Receber", larguraMm: 36, align: "right" },
  { titulo: "Recebido", larguraMm: 34, align: "right" },
  { titulo: "Saldo", larguraMm: 34, align: "right" },
];

type LinhaCliente = {
  cliente: string;
  valorAReceber: number;
  recebido: number;
  saldo: number;
};

function agruparPorCliente(linhas: LinhaRelatorioContasReceber[]): LinhaCliente[] {
  const mapa = new Map<string, LinhaCliente>();
  for (const linha of linhas) {
    const chave = linha.cliente.trim();
    if (!chave) continue;
    const atual = mapa.get(chave) ?? {
      cliente: chave,
      valorAReceber: 0,
      recebido: 0,
      saldo: 0,
    };
    atual.valorAReceber += linha.valor;
    atual.recebido += linha.recebido;
    atual.saldo += linha.saldo;
    mapa.set(chave, atual);
  }
  return Array.from(mapa.values()).sort((a, b) =>
    a.cliente.localeCompare(b.cliente, "pt-BR")
  );
}

function moneyRs(value: number) {
  return `R$ ${moneyBr(value)}`;
}

function desenharLinhaTotal(
  ctx: ContextoTabelaFaturasSmart,
  totalValor: number,
  totalRecebido: number,
  totalSaldo: number
) {
  const altura = ctx.rowH;
  const valores = ["Total", moneyRs(totalValor), moneyRs(totalRecebido), moneyRs(totalSaldo)];
  novaPaginaTabelaFaturasSmart(ctx, altura);

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

/** Layout Smart Prótese — Parcelas (A Receber) Modelo 1: resumo por cliente. */
export async function gerarRelatorioParcelasAReceberModelo1Pdf(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesRelatorioParcelasAReceberModelo1
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf, COLUNAS);

  const titulo = `Relatório de Parcelas a Receber - (${tituloPeriodoSmart(opcoes.periodoCampo)})`;

  const api = pdf as unknown as Parameters<typeof desenharCabecalhoLabRelatorioPdf>[0];
  ctx.y = desenharCabecalhoLabRelatorioPdf(api, ctx.margin, ctx.y);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...PRETO);
  pdf.text(titulo, ctx.pageW / 2, ctx.y, { align: "center" });
  ctx.y += 10;

  const porCliente = agruparPorCliente(linhasFiltradas(linhas, opcoes));
  const totalValor = porCliente.reduce((s, l) => s + l.valorAReceber, 0);
  const totalRecebido = porCliente.reduce((s, l) => s + l.recebido, 0);
  const totalSaldo = porCliente.reduce((s, l) => s + l.saldo, 0);

  desenharLinhaTabelaFaturasSmart(
    ctx,
    COLUNAS.map((c) => c.titulo),
    { header: true, fillHeader: true }
  );

  if (porCliente.length === 0) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, [
      "Nenhuma parcela a receber no período",
      "R$ 0,00",
      "R$ 0,00",
      "R$ 0,00",
    ]);
  } else {
    for (const linha of porCliente) {
      novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
      desenharLinhaTabelaFaturasSmart(ctx, [
        linha.cliente,
        moneyRs(linha.valorAReceber),
        moneyRs(linha.recebido),
        moneyRs(linha.saldo),
      ]);
    }
  }

  desenharLinhaTotal(ctx, totalValor, totalRecebido, totalSaldo);

  return pdf.output("blob");
}
