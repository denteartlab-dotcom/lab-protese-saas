import { parseHistoricoSituacao } from "@/lib/historico-situacao-os";
import { normalizarChaveStatusOs } from "@/lib/status-os";
import { grupoOsIdOf } from "@/lib/trabalho-os-segmento";
import { obterFusoSistema } from "@/lib/timezone";

/** Chave estável da OS para o mapa de início de produção (sem I/O). */
export function chaveInicioProducaoOs(trabalho: {
  id: string;
  grupoOsId?: string | null;
}) {
  return grupoOsIdOf(trabalho);
}

export function interpretarInicioProducaoOs(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function statusContaTempoProducao(status?: string | null) {
  return normalizarChaveStatusOs(status) === "producao";
}

/** Dia civil no fuso do laboratório, no formato YYYY-MM-DD. */
export function chaveDiaCalendario(date: Date, fuso = obterFusoSistema()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function diferencaDiasCalendario(inicioIso: string, fimIso: string) {
  const [y1, m1, d1] = inicioIso.split("-").map(Number);
  const [y2, m2, d2] = fimIso.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/**
 * Dia civil do instante. Datas gravadas à meia-noite local já são um dia de
 * calendário (prazo); não desloca esse dia por causa do fuso.
 */
export function chaveDiaContagem(date: Date, fuso = obterFusoSistema()) {
  const noFuso = chaveDiaCalendario(date, fuso);
  if (date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0) {
    return noFuso;
  }
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mes}-${dia}`;
}

function diaDeInstante(value: string | Date | null | undefined, fuso: string) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return chaveDiaContagem(date, fuso);
}

function diaMaisRecente(a: string | null, b: string | null) {
  if (a && b) return a > b ? a : b;
  return a || b;
}

function diaMaisAntigo(a: string | null, b: string | null) {
  if (a && b) return a < b ? a : b;
  return a || b;
}

/**
 * Dia da última entrada em Produção no histórico,
 * só se essa ainda for a situação mais recente registrada.
 */
export function diaUltimaEntradaProducaoHistorico(instrucoes?: string | null) {
  const entradas = parseHistoricoSituacao(instrucoes);
  const ultima = entradas[entradas.length - 1];
  if (!ultima || !statusContaTempoProducao(ultima.status)) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(ultima.data) ? ultima.data : null;
}

export type OrigemContagemProducao = {
  status?: string | null;
  /** ISO gravado ao entrar em Produção. É apagado quando a OS sai dessa situação. */
  inicioRegistrado?: string | null;
  instrucoes?: string | null;
  dataEntrada?: string | Date | null;
};

/**
 * Dia em que a contagem atual começou.
 * Fora de Produção não há contagem. Na reentrada vale o dia mais recente
 * entre o registro de início e o histórico. OS criada já em Produção,
 * sem mudança de situação, conta da data de entrada.
 */
export function diaInicioContagemProducao(
  origem: OrigemContagemProducao,
  fuso = obterFusoSistema()
) {
  if (!statusContaTempoProducao(origem.status)) return null;

  const doMapa = origem.inicioRegistrado
    ? diaDeInstante(interpretarInicioProducaoOs(origem.inicioRegistrado), fuso)
    : null;
  const entradas = parseHistoricoSituacao(origem.instrucoes);
  const doHistorico = diaUltimaEntradaProducaoHistorico(origem.instrucoes);
  const diaEntrada = diaDeInstante(origem.dataEntrada ?? null, fuso);

  if (doHistorico) return diaMaisRecente(doHistorico, doMapa);
  if (entradas.length === 0) return diaMaisAntigo(doMapa, diaEntrada);
  return doMapa ?? diaEntrada;
}

/** Dias desde a entrada (ou reentrada) em Produção. Em qualquer outra situação, zero. */
export function diasNaSituacaoProducao(
  origem: OrigemContagemProducao,
  referencia = new Date(),
  fuso = obterFusoSistema()
) {
  const inicio = diaInicioContagemProducao(origem, fuso);
  if (!inicio) return 0;
  const hoje = chaveDiaContagem(referencia, fuso);
  return Math.max(0, diferencaDiasCalendario(inicio, hoje));
}

/**
 * Dias de atraso só com situação Produção.
 * A contagem parte do prazo. Se a OS entrou ou voltou para Produção depois do prazo,
 * recomeça no dia dessa entrada. Fora de Produção, não conta.
 */
export function diasAtrasoContadosNaProducao(
  origem: OrigemContagemProducao & { prazo?: Date | null },
  referencia = new Date(),
  fuso = obterFusoSistema()
) {
  if (!statusContaTempoProducao(origem.status)) return 0;
  if (!origem.prazo || Number.isNaN(origem.prazo.getTime())) return 0;

  const hoje = chaveDiaContagem(referencia, fuso);
  const diaPrazo = chaveDiaContagem(origem.prazo, fuso);
  if (diferencaDiasCalendario(diaPrazo, hoje) <= 0) return 0;

  const diaInicio = diaInicioContagemProducao(origem, fuso);
  const base = diaInicio && diaInicio > diaPrazo ? diaInicio : diaPrazo;
  return Math.max(0, diferencaDiasCalendario(base, hoje));
}
