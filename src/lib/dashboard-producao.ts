/** Resumo de produção do Início — mesma base do Controle de Produção (somente serviços). */

import { segmentoEfetivoTrabalho } from "@/lib/trabalho-os-segmento";

export type TrabalhoProducaoResumo = {
  id: string;
  status: string;
  dataEntrada: string | Date;
  segmentoFaturamento?: string | null;
  instrucoes?: string | null;
  tipoProtese?: string;
};

/** Produto e transporte não entram no donut / percentual do Início. */
export function trabalhoContaNoGraficoProducao(t: TrabalhoProducaoResumo): boolean {
  const segmento = segmentoEfetivoTrabalho({
    segmentoFaturamento: t.segmentoFaturamento,
    instrucoes: t.instrucoes,
  });
  if (segmento !== "servico") return false;
  const texto = (t.tipoProtese || "").trim();
  if (/^produto:/i.test(texto) || /^(transporte|frete):/i.test(texto)) return false;
  return true;
}

const STATUS_CONCLUIDO = ["finalizado", "saiu_entrega", "entregue"] as const;
const STATUS_PENDENTE_LAB = ["producao", "prova", "pendente", "pedido"] as const;

export type ContagemProducaoStatus = {
  finalizado: number;
  saiu_entrega: number;
  entregue: number;
  producao: number;
  prova: number;
  pendente: number;
  pedido: number;
};

export type ResumoProducaoDashboard = {
  porStatus: ContagemProducaoStatus;
  concluido: number;
  pendente: number;
  percentual: number;
  total: number;
};

function noMes(
  dataEntrada: string | Date,
  mes: number,
  ano: number
) {
  const d = new Date(dataEntrada);
  return d.getMonth() === mes && d.getFullYear() === ano;
}

export function calcularResumoProducaoDashboard(
  trabalhos: TrabalhoProducaoResumo[],
  mes: number,
  ano: number,
  filtrarPorMes = true
): ResumoProducaoDashboard {
  const porStatus: ContagemProducaoStatus = {
    finalizado: 0,
    saiu_entrega: 0,
    entregue: 0,
    producao: 0,
    prova: 0,
    pendente: 0,
    pedido: 0,
  };

  for (const t of trabalhos) {
    if (t.status === "cancelado") continue;
    if (!trabalhoContaNoGraficoProducao(t)) continue;
    if (filtrarPorMes && !noMes(t.dataEntrada, mes, ano)) continue;
    if (t.status in porStatus) {
      porStatus[t.status as keyof ContagemProducaoStatus] += 1;
    }
  }

  const concluido =
    porStatus.finalizado + porStatus.saiu_entrega + porStatus.entregue;
  const pendente =
    porStatus.producao + porStatus.prova + porStatus.pendente + porStatus.pedido;
  const total = concluido + pendente;
  const percentual = total > 0 ? Math.round((concluido / total) * 100) : 0;

  return { porStatus, concluido, pendente, percentual, total };
}

export function hrefControlePorStatus(status: string) {
  return `/app/producao/controle?status=${encodeURIComponent(status)}`;
}
