/** Resumo de produção do Início — mesma base do Controle de Produção (somente serviços). */

import { segmentoEfetivoTrabalho } from "@/lib/trabalho-os-segmento";

export type TrabalhoProducaoResumo = {
  id: string;
  numeroOs?: number;
  grupoOsId?: string | null;
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

/** Mesma OS (número igual) conta uma única vez no gráfico de produção. */
function chaveOsProducao(t: TrabalhoProducaoResumo) {
  if (Number.isFinite(t.numeroOs) && (t.numeroOs ?? 0) > 0) {
    return `os-${t.numeroOs}`;
  }
  if (t.grupoOsId) return t.grupoOsId;
  return t.id;
}

function escolherTrabalhoRepresentanteOs(lista: TrabalhoProducaoResumo[]) {
  const servico =
    lista.find(
      (t) =>
        segmentoEfetivoTrabalho({
          segmentoFaturamento: t.segmentoFaturamento,
          instrucoes: t.instrucoes,
        }) === "servico"
    ) || lista[0];
  return servico;
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

  const grupos = new Map<string, TrabalhoProducaoResumo[]>();

  for (const t of trabalhos) {
    if (t.status === "cancelado") continue;
    if (!trabalhoContaNoGraficoProducao(t)) continue;
    if (filtrarPorMes && !noMes(t.dataEntrada, mes, ano)) continue;
    const chave = chaveOsProducao(t);
    const lista = grupos.get(chave) || [];
    lista.push(t);
    grupos.set(chave, lista);
  }

  for (const lista of grupos.values()) {
    const t = escolherTrabalhoRepresentanteOs(lista);
    if (t.status in porStatus) {
      porStatus[t.status as keyof ContagemProducaoStatus] += 1;
    }
  }

  const concluido = porStatus.finalizado + porStatus.entregue;
  const pendente =
    porStatus.producao +
    porStatus.prova +
    porStatus.pendente +
    porStatus.pedido +
    porStatus.saiu_entrega;
  const total = concluido + pendente;
  const percentual = total > 0 ? Math.round((concluido / total) * 100) : 0;

  return { porStatus, concluido, pendente, percentual, total };
}

export function hrefControlePorStatus(status: string) {
  return `/app/producao/controle?status=${encodeURIComponent(status)}`;
}
