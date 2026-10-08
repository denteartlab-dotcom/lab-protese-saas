/**
 * Diárias de colaboradores: jornada, horas trabalhadas e valor proporcional.
 */
import {
  nomeMesCompetenciaPt,
  slugColaboradorComissao,
} from "@/lib/comissao-colaboradores-pagamento";
import {
  parseValorNumericoBr,
  formatValorMonetarioInput,
  usaDiariaColaborador,
} from "@/lib/colaborador-remuneracao";
import { COLABORADORES_STORAGE_KEY } from "@/lib/colaboradores-listagem";
import { dateKeyLocal } from "@/lib/controle-producao-prazos";
import {
  clonarHorarioFuncionamento,
  DIAS_SEMANA_PADRAO,
  type DiaFuncionamento,
  type HorarioFuncionamentoConfig,
} from "@/lib/horario-funcionamento";
import { persistirArmazenamentoImediato, readStorage, writeStorage } from "@/lib/persisted-storage";

export const DIARIAS_STORAGE_KEY = "labProteseDiariasColaboradores";
export const DIARIAS_ATUALIZADAS_EVENT = "lab-protese-diarias-atualizadas";
export const HORAS_JORNADA_PADRAO = 8;
export const DIAS_UTEIS_MES_PADRAO = 22;
export const ENTRADA_PADRAO = "08:00";
export const SAIDA_MANHA_PADRAO = "12:00";
export const ENTRADA_TARDE_PADRAO = "13:00";
export const SAIDA_PADRAO = "17:00";

export type ConfigDiariaColaborador = {
  colaboradorId: string;
  colaboradorNome: string;
  valorDiaria: string;
  horasJornada: number;
};

export type LancamentoDiaria = {
  id: string;
  colaboradorId: string;
  data: string;
  entrada: string;
  saidaManha?: string;
  entradaTarde?: string;
  saida: string;
  intervaloMinutos: number;
  horas: number;
  valor: number;
  valorManual?: boolean;
  observacao?: string;
};

export type HorarioDoisTurnos = {
  entrada: string;
  saidaManha: string;
  entradaTarde: string;
  saida: string;
};

export type DespesaDiariaRef = {
  id: string;
  status?: string;
  colaboradorId?: string;
  colaboradorNome?: string;
  mesCompetencia?: string;
};

export type DiariasStore = {
  configs: Record<string, ConfigDiariaColaborador>;
  lancamentos: LancamentoDiaria[];
  despesas: Record<string, DespesaDiariaRef>;
};

export type TotalDiariaCompetencia = {
  colaboradorId: string;
  colaboradorNome: string;
  mesCompetencia: string;
  valor: number;
};

export type ColaboradorDiariaOrigem = {
  id: string;
  nome: string;
  valorSalario: string;
  valorDiaria: string;
  tipoContratacao: string;
  cargaHoraria: HorarioFuncionamentoConfig | null;
};

type ColaboradorStorageDiaria = {
  id?: string;
  nome?: string;
  dados?: Record<string, string>;
  cargaHoraria?: HorarioFuncionamentoConfig;
};

const JS_DAY_TO_ID = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
] as const;

const STORE_VAZIO: DiariasStore = { configs: {}, lancamentos: [], despesas: {} };

export function storeDiariasVazio(): DiariasStore {
  return { configs: {}, lancamentos: [], despesas: {} };
}

export function referenciaDespesaDiariaColaborador(nome: string, mesCompetencia: string) {
  return `diaria-colab:${slugColaboradorComissao(nome)}:${mesCompetencia}`;
}

export function ehReferenciaDespesaDiariaColaborador(referencia?: string | null) {
  return /^diaria-colab:[a-z0-9-]+:\d{4}-\d{2}$/.test((referencia || "").trim());
}

export function descricaoDespesaDiariaColaborador(nome: string, mesCompetencia: string) {
  return `Diária ${nome} — ${nomeMesCompetenciaPt(mesCompetencia)}`;
}

export function chaveDespesaDiariaStore(nome: string, mesCompetencia: string) {
  return referenciaDespesaDiariaColaborador(nome, mesCompetencia);
}

export function mesCompetenciaDeDataIso(data: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data.slice(0, 7) : "";
}

export function registrarDespesaDiariaStore(
  store: DiariasStore,
  colaboradorNome: string,
  mesCompetencia: string,
  despesa: DespesaDiariaRef
): DiariasStore {
  return {
    ...store,
    despesas: {
      ...store.despesas,
      [chaveDespesaDiariaStore(colaboradorNome, mesCompetencia)]: despesa,
    },
  };
}

export function removerDespesaDiariaStore(
  store: DiariasStore,
  colaboradorNome: string,
  mesCompetencia: string
): DiariasStore {
  const despesas = { ...store.despesas };
  delete despesas[chaveDespesaDiariaStore(colaboradorNome, mesCompetencia)];
  return { ...store, despesas };
}

export function totaisDiariasPorCompetencia(store: DiariasStore): TotalDiariaCompetencia[] {
  const mapa = new Map<string, TotalDiariaCompetencia>();

  for (const lancamento of store.lancamentos) {
    const mesCompetencia = mesCompetenciaDeDataIso(lancamento.data);
    if (!mesCompetencia) continue;
    const config = store.configs[lancamento.colaboradorId];
    const colaboradorNome = config?.colaboradorNome?.trim() || lancamento.colaboradorId;
    const chave = `${lancamento.colaboradorId}::${mesCompetencia}`;
    const atual = mapa.get(chave);
    if (atual) {
      atual.valor += Number(lancamento.valor) || 0;
    } else {
      mapa.set(chave, {
        colaboradorId: lancamento.colaboradorId,
        colaboradorNome,
        mesCompetencia,
        valor: Number(lancamento.valor) || 0,
      });
    }
  }

  for (const [ref, despesa] of Object.entries(store.despesas || {})) {
    if (!ehReferenciaDespesaDiariaColaborador(ref)) continue;
    const mesCompetencia = despesa.mesCompetencia || ref.split(":").pop() || "";
    const colaboradorId = despesa.colaboradorId || "";
    const colaboradorNome = despesa.colaboradorNome?.trim() || "";
    if (!mesCompetencia) continue;
    const chaveLocal = colaboradorId
      ? `${colaboradorId}::${mesCompetencia}`
      : `ref::${ref}`;
    if (mapa.has(chaveLocal) || [...mapa.values()].some((item) => chaveDespesaDiariaStore(item.colaboradorNome, item.mesCompetencia) === ref)) {
      continue;
    }
    mapa.set(chaveLocal, {
      colaboradorId: colaboradorId || ref,
      colaboradorNome: colaboradorNome || ref,
      mesCompetencia,
      valor: 0,
    });
  }

  return [...mapa.values()].map((item) => ({
    ...item,
    valor: Math.round(item.valor * 100) / 100,
  }));
}

export function minutosDeHora(hora: string): number | null {
  const match = String(hora || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function minutosParaHora(minutos: number): string {
  const ciclo = 24 * 60;
  const normalizado = ((Math.round(minutos) % ciclo) + ciclo) % ciclo;
  const h = Math.floor(normalizado / 60);
  const m = normalizado % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function minutosLiquidosTurno(
  entrada: string,
  saida: string,
  intervaloMinutos = 0
): number {
  const ini = minutosDeHora(entrada);
  const fim = minutosDeHora(saida);
  if (ini == null || fim == null) return 0;
  let delta = fim - ini;
  if (delta <= 0) delta += 24 * 60;
  return Math.max(0, delta - Math.max(0, Number(intervaloMinutos) || 0));
}

export function horasTrabalhadas(
  entrada: string,
  saida: string,
  intervaloMinutos = 0
): number {
  return minutosLiquidosTurno(entrada, saida, intervaloMinutos) / 60;
}

export function formatarHoraDigitada(value: string): string {
  const limpo = String(value || "")
    .replace(/[^\d:]/g, "")
    .slice(0, 5);
  const partes = limpo.split(":");
  const hora = (partes[0] || "").slice(0, 2);
  const minuto = (partes[1] || "").slice(0, 2);
  if (!hora && !minuto) return "";
  if (hora.length < 2) return hora;
  if (!limpo.includes(":")) return hora;
  return `${hora}:${minuto}`;
}

export function horaTextoValida(value: string): string {
  const texto = String(value || "").trim();
  if (!texto) return "";
  const match = texto.match(/^(\d{1,2})(?::(\d{0,2}))?$/);
  if (!match) return "";
  const hora = Math.min(23, Math.max(0, Number(match[1]) || 0));
  const minuto = Math.min(59, Math.max(0, Number(match[2] || "0") || 0));
  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

export function horarioTemTurno(inicio?: string, fim?: string): boolean {
  return minutosDeHora(inicio || "") != null && minutosDeHora(fim || "") != null;
}

/** Horas pagas: da primeira entrada à última saída, sem descontar o intervalo. */
export function horasLancamentoDiaria(
  lancamento: Pick<LancamentoDiaria, "entrada" | "saida" | "saidaManha" | "entradaTarde">
): number {
  const temManha = horarioTemTurno(lancamento.entrada, lancamento.saidaManha);
  const temTarde = horarioTemTurno(lancamento.entradaTarde, lancamento.saida);
  if (temManha && temTarde) {
    return minutosLiquidosTurno(lancamento.entrada, lancamento.saida, 0) / 60;
  }
  if (temManha) {
    return minutosLiquidosTurno(lancamento.entrada, lancamento.saidaManha || "", 0) / 60;
  }
  if (temTarde) {
    return minutosLiquidosTurno(lancamento.entradaTarde || "", lancamento.saida, 0) / 60;
  }
  return minutosLiquidosTurno(lancamento.entrada, lancamento.saida, 0) / 60;
}

export function textoHorarioLancamento(
  lancamento: Pick<LancamentoDiaria, "entrada" | "saida" | "saidaManha" | "entradaTarde">
): string {
  const temManha = horarioTemTurno(lancamento.entrada, lancamento.saidaManha);
  const temTarde = horarioTemTurno(lancamento.entradaTarde, lancamento.saida);
  if (temManha && temTarde) {
    return `${lancamento.entrada}–${lancamento.saidaManha}\n${lancamento.entradaTarde}–${lancamento.saida}`;
  }
  if (temManha) return `${lancamento.entrada}–${lancamento.saidaManha}`;
  if (temTarde) return `${lancamento.entradaTarde}–${lancamento.saida}`;
  if (lancamento.entrada && lancamento.saida) return `${lancamento.entrada}–${lancamento.saida}`;
  return "";
}

export function textoIntervaloLancamento(
  lancamento: Pick<LancamentoDiaria, "saidaManha" | "entradaTarde">
): string {
  const saidaManha = horaTextoValida(lancamento.saidaManha || "");
  const entradaTarde = horaTextoValida(lancamento.entradaTarde || "");
  if (!saidaManha || !entradaTarde) return "";
  return `${saidaManha} às ${entradaTarde}`;
}

export function valorDiariaProporcional(
  horas: number,
  horasJornada: number,
  valorDiaria: number
): number {
  const jornada = horasJornada > 0 ? horasJornada : HORAS_JORNADA_PADRAO;
  if (horas <= 0 || valorDiaria <= 0) return 0;
  return Math.round((horas / jornada) * valorDiaria * 100) / 100;
}

export function formatarHorasDecimais(horas: number): string {
  const sinal = horas < 0 ? "-" : "";
  const totalMin = Math.round(Math.abs(horas) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${sinal}${h}h${String(m).padStart(2, "0")}`;
}

export function minutosIntervalosDia(dia: Pick<DiaFuncionamento, "intervalos">): number {
  return (dia.intervalos || []).reduce((soma, intervalo) => {
    return soma + minutosLiquidosTurno(intervalo.inicio, intervalo.fim, 0);
  }, 0);
}

export function horasJornadaDoDia(dia: DiaFuncionamento): number {
  if (!dia.ativo || !dia.inicio || !dia.fim) return 0;
  return minutosLiquidosTurno(dia.inicio, dia.fim, minutosIntervalosDia(dia)) / 60;
}

export function idDiaSemanaDeData(data: string): (typeof JS_DAY_TO_ID)[number] | null {
  const [ano, mes, dia] = data.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const date = new Date(ano, mes - 1, dia);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== ano) return null;
  return JS_DAY_TO_ID[date.getDay()] || null;
}

export function diaCargaPorData(
  carga: HorarioFuncionamentoConfig | null | undefined,
  data: string
): DiaFuncionamento | null {
  const id = idDiaSemanaDeData(data);
  if (!id) return null;
  const dias = carga?.dias?.length
    ? carga.dias
    : DIAS_SEMANA_PADRAO.map((d) => ({ ...d, intervalos: [] }));
  return dias.find((item) => item.id === id) || null;
}

export function horarioPadraoDoDia(
  carga: HorarioFuncionamentoConfig | null | undefined,
  data: string
): HorarioDoisTurnos {
  const dia = diaCargaPorData(carga, data);
  if (dia?.ativo && dia.inicio && dia.fim) {
    const intervalo = (dia.intervalos || []).find((item) => item.inicio && item.fim);
    return {
      entrada: dia.inicio,
      saidaManha: intervalo?.inicio || SAIDA_MANHA_PADRAO,
      entradaTarde: intervalo?.fim || ENTRADA_TARDE_PADRAO,
      saida: dia.fim,
    };
  }
  return {
    entrada: ENTRADA_PADRAO,
    saidaManha: SAIDA_MANHA_PADRAO,
    entradaTarde: ENTRADA_TARDE_PADRAO,
    saida: SAIDA_PADRAO,
  };
}

export function horasJornadaDaCarga(
  carga: HorarioFuncionamentoConfig | null | undefined
): number {
  const ativos = (carga?.dias || []).filter((dia) => dia.ativo && dia.inicio && dia.fim);
  if (ativos.length === 0) return HORAS_JORNADA_PADRAO;
  const media = ativos.reduce((soma, dia) => soma + horasJornadaDoDia(dia), 0) / ativos.length;
  if (media <= 0) return HORAS_JORNADA_PADRAO;
  return Math.round(media * 2) / 2;
}

export function sugerirValorDiaria(
  valorSalario: string,
  diasUteis = DIAS_UTEIS_MES_PADRAO
): string {
  const salario = parseValorNumericoBr(valorSalario);
  if (salario <= 0) return "0,00";
  const diaria = salario / Math.max(1, diasUteis);
  return formatValorMonetarioInput(String(Math.round(diaria * 100)));
}

export function formatarValorDiariaCadastro(valor: string): string {
  const numero = parseValorNumericoBr(valor);
  if (numero <= 0) return "0,00";
  return formatValorMonetarioInput(String(Math.round(numero * 100)));
}

/** Prefere o valor cadastrado; se vazio, mantém o atual ou sugere pelo salário. */
export function valorDiariaDeOrigem(
  origem: Pick<ColaboradorDiariaOrigem, "valorDiaria" | "valorSalario">,
  atual?: string
): string {
  if (parseValorNumericoBr(origem.valorDiaria || "") > 0) {
    return formatarValorDiariaCadastro(origem.valorDiaria);
  }
  if (parseValorNumericoBr(atual || "") > 0) return atual || "0,00";
  return sugerirValorDiaria(origem.valorSalario);
}

export function novoIdLancamento(): string {
  return `dia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recalcularLancamento(
  lancamento: LancamentoDiaria,
  config: ConfigDiariaColaborador
): LancamentoDiaria {
  const horas = horasLancamentoDiaria(lancamento);
  if (lancamento.valorManual) {
    return {
      ...lancamento,
      horas,
      valor: Math.round(Math.max(0, Number(lancamento.valor) || 0) * 100) / 100,
    };
  }
  const valor = valorDiariaProporcional(
    horas,
    config.horasJornada,
    parseValorNumericoBr(config.valorDiaria)
  );
  return { ...lancamento, horas, valor };
}

export function aplicarValorManualLancamento(
  lancamento: LancamentoDiaria,
  valor: number
): LancamentoDiaria {
  return {
    ...lancamento,
    valor: Math.round(Math.max(0, Number(valor) || 0) * 100) / 100,
    valorManual: true,
  };
}

export function criarLancamentoDiaria(
  colaboradorId: string,
  data: string,
  config: ConfigDiariaColaborador,
  horario: HorarioDoisTurnos,
  observacao?: string
): LancamentoDiaria {
  return recalcularLancamento(
    {
      id: novoIdLancamento(),
      colaboradorId,
      data,
      entrada: horario.entrada,
      saidaManha: horario.saidaManha,
      entradaTarde: horario.entradaTarde,
      saida: horario.saida,
      intervaloMinutos: 0,
      horas: 0,
      valor: 0,
      observacao,
    },
    config
  );
}

export function datasDoMes(ano: number, mes: number): string[] {
  const ultimo = new Date(ano, mes, 0).getDate();
  const lista: string[] = [];
  for (let dia = 1; dia <= ultimo; dia += 1) {
    lista.push(`${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  }
  return lista;
}

export function celulasCalendarioMes(ano: number, mes: number): Array<string | null> {
  const primeiro = new Date(ano, mes - 1, 1);
  const offset = primeiro.getDay() === 0 ? 6 : primeiro.getDay() - 1;
  const celulas: Array<string | null> = Array.from({ length: offset }, () => null);
  celulas.push(...datasDoMes(ano, mes));
  while (celulas.length % 7 !== 0) celulas.push(null);
  return celulas;
}

export function cargaTemJornada(carga: HorarioFuncionamentoConfig | null | undefined) {
  return Boolean(carga?.dias?.some((dia) => dia.ativo && dia.inicio && dia.fim));
}

export function diaDeveTrabalhar(
  carga: HorarioFuncionamentoConfig | null | undefined,
  data: string
) {
  const id = idDiaSemanaDeData(data);
  if (!id) return false;
  if (cargaTemJornada(carga)) {
    const dia = diaCargaPorData(carga, data);
    return Boolean(dia?.ativo && dia.inicio && dia.fim);
  }
  return id !== "sabado" && id !== "domingo";
}

export function atualizarConfigERecalcular(
  store: DiariasStore,
  config: ConfigDiariaColaborador
): DiariasStore {
  const horasJornada = Math.min(24, Math.max(0.5, Number(config.horasJornada) || HORAS_JORNADA_PADRAO));
  const normalizada: ConfigDiariaColaborador = { ...config, horasJornada };
  return {
    ...store,
    configs: { ...store.configs, [normalizada.colaboradorId]: normalizada },
    lancamentos: store.lancamentos.map((lancamento) =>
      lancamento.colaboradorId === normalizada.colaboradorId
        ? recalcularLancamento(lancamento, normalizada)
        : lancamento
    ),
  };
}

export function preencherMesComJornada(
  store: DiariasStore,
  colaboradorId: string,
  ano: number,
  mes: number,
  carga: HorarioFuncionamentoConfig | null | undefined
): DiariasStore {
  const config = store.configs[colaboradorId];
  if (!config) return store;
  const existentes = new Set(
    store.lancamentos
      .filter((lancamento) => lancamento.colaboradorId === colaboradorId)
      .map((lancamento) => lancamento.data)
  );
  const novos: LancamentoDiaria[] = [];
  for (const data of datasDoMes(ano, mes)) {
    if (existentes.has(data) || !diaDeveTrabalhar(carga, data)) continue;
    novos.push(
      criarLancamentoDiaria(colaboradorId, data, config, horarioPadraoDoDia(carga, data))
    );
  }
  return { ...store, lancamentos: [...store.lancamentos, ...novos] };
}

export function limparLancamentosMes(
  store: DiariasStore,
  colaboradorId: string,
  ano: number,
  mes: number
): DiariasStore {
  const prefixo = `${ano}-${String(mes).padStart(2, "0")}-`;
  return {
    ...store,
    lancamentos: store.lancamentos.filter(
      (lancamento) =>
        !(lancamento.colaboradorId === colaboradorId && lancamento.data.startsWith(prefixo))
    ),
  };
}

export function prefixoMesDiarias(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}-`;
}

export function lancamentosDoMes(
  store: DiariasStore,
  colaboradorId: string,
  ano: number,
  mes: number
) {
  const prefixo = prefixoMesDiarias(ano, mes);
  return store.lancamentos
    .filter(
      (lancamento) =>
        lancamento.colaboradorId === colaboradorId && lancamento.data.startsWith(prefixo)
    )
    .sort((a, b) => a.data.localeCompare(b.data));
}

export function resumoDiariasMes(
  store: DiariasStore,
  colaboradorId: string,
  ano: number,
  mes: number
) {
  const itens = lancamentosDoMes(store, colaboradorId, ano, mes);
  return {
    dias: itens.length,
    horas: itens.reduce((soma, item) => soma + item.horas, 0),
    valor: itens.reduce((soma, item) => soma + item.valor, 0),
  };
}

export type ResumoColaboradorDiariaMes = {
  colaboradorId: string;
  colaboradorNome: string;
  valorDiaria: string;
  horasJornada: number;
  dias: number;
  horas: number;
  valor: number;
  lancamentos: LancamentoDiaria[];
};

export function resumosColaboradoresDiariasMes(
  store: DiariasStore,
  ano: number,
  mes: number
): ResumoColaboradorDiariaMes[] {
  const ids = new Set<string>();
  const prefixo = prefixoMesDiarias(ano, mes);
  for (const lancamento of store.lancamentos) {
    if (lancamento.data.startsWith(prefixo)) ids.add(lancamento.colaboradorId);
  }
  for (const id of Object.keys(store.configs)) ids.add(id);

  const lista: ResumoColaboradorDiariaMes[] = [];
  for (const id of ids) {
    const config = store.configs[id];
    const lancamentos = lancamentosDoMes(store, id, ano, mes);
    if (lancamentos.length === 0 && !config) continue;
    const resumo = resumoDiariasMes(store, id, ano, mes);
    lista.push({
      colaboradorId: id,
      colaboradorNome: config?.colaboradorNome || lancamentos[0]?.colaboradorId || id,
      valorDiaria: config?.valorDiaria || "0,00",
      horasJornada: config?.horasJornada || HORAS_JORNADA_PADRAO,
      ...resumo,
      lancamentos,
    });
  }
  return lista.sort((a, b) => {
    if (b.valor !== a.valor) return b.valor - a.valor;
    return a.colaboradorNome.localeCompare(b.colaboradorNome, "pt-BR");
  });
}

export function resumoGeralDiariasMes(store: DiariasStore, ano: number, mes: number) {
  const colaboradores = resumosColaboradoresDiariasMes(store, ano, mes).filter(
    (item) => item.dias > 0
  );
  return {
    colaboradores: colaboradores.length,
    dias: colaboradores.reduce((soma, item) => soma + item.dias, 0),
    horas: colaboradores.reduce((soma, item) => soma + item.horas, 0),
    valor: colaboradores.reduce((soma, item) => soma + item.valor, 0),
    itens: colaboradores,
  };
}

export function nomeMesAnoDiarias(
  ano: number,
  mes: number,
  locale: "pt" | "en" | "es" = "pt"
) {
  const tag = locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "pt-BR";
  const texto = new Date(ano, mes - 1, 1).toLocaleDateString(tag, {
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatarDataIsoBr(data: string) {
  const [ano, mes, dia] = data.split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

export function lancamentoDoDia(
  store: DiariasStore,
  colaboradorId: string,
  data: string
) {
  return (
    store.lancamentos.find(
      (lancamento) => lancamento.colaboradorId === colaboradorId && lancamento.data === data
    ) || null
  );
}

export function upsertLancamento(store: DiariasStore, lancamento: LancamentoDiaria): DiariasStore {
  const config = store.configs[lancamento.colaboradorId];
  const calculado = config ? recalcularLancamento(lancamento, config) : lancamento;
  const indice = store.lancamentos.findIndex(
    (item) =>
      item.id === calculado.id ||
      (item.colaboradorId === calculado.colaboradorId && item.data === calculado.data)
  );
  if (indice < 0) {
    return { ...store, lancamentos: [...store.lancamentos, calculado] };
  }
  const lista = [...store.lancamentos];
  lista[indice] = { ...calculado, id: lista[indice].id };
  return { ...store, lancamentos: lista };
}

export function removerLancamentoDia(
  store: DiariasStore,
  colaboradorId: string,
  data: string
): DiariasStore {
  return {
    ...store,
    lancamentos: store.lancamentos.filter(
      (lancamento) =>
        !(lancamento.colaboradorId === colaboradorId && lancamento.data === data)
    ),
  };
}

export function garantirConfigColaborador(
  store: DiariasStore,
  colaborador: ColaboradorDiariaOrigem
): DiariasStore {
  const atual = store.configs[colaborador.id];
  const valorDiaria = valorDiariaDeOrigem(colaborador, atual?.valorDiaria);
  if (atual) {
    if (atual.colaboradorNome === colaborador.nome && atual.valorDiaria === valorDiaria) {
      return store;
    }
    if (atual.valorDiaria === valorDiaria) {
      return {
        ...store,
        configs: {
          ...store.configs,
          [colaborador.id]: { ...atual, colaboradorNome: colaborador.nome },
        },
      };
    }
    return atualizarConfigERecalcular(store, {
      ...atual,
      colaboradorNome: colaborador.nome,
      valorDiaria,
    });
  }
  return atualizarConfigERecalcular(store, {
    colaboradorId: colaborador.id,
    colaboradorNome: colaborador.nome,
    valorDiaria,
    horasJornada: horasJornadaDaCarga(colaborador.cargaHoraria),
  });
}

export function aplicarCadastroNaConfigDiaria(
  store: DiariasStore,
  colaborador: {
    id: string;
    nome: string;
    valorDiaria?: string;
    valorSalario?: string;
    cargaHoraria?: HorarioFuncionamentoConfig | null;
  }
): DiariasStore {
  const atual = store.configs[colaborador.id];
  const valorDiaria = valorDiariaDeOrigem(
    {
      valorDiaria: colaborador.valorDiaria || "0,00",
      valorSalario: colaborador.valorSalario || "0,00",
    },
    atual?.valorDiaria
  );
  return atualizarConfigERecalcular(store, {
    colaboradorId: colaborador.id,
    colaboradorNome: colaborador.nome,
    valorDiaria,
    horasJornada: atual?.horasJornada ?? horasJornadaDaCarga(colaborador.cargaHoraria),
  });
}

export function sincronizarCadastroComDiarias(colaborador: {
  id: string;
  nome: string;
  dados?: Record<string, string>;
  cargaHoraria?: HorarioFuncionamentoConfig;
}) {
  if (typeof window === "undefined") return;
  const tipo = colaborador.dados?.tipoContratacao || "";
  const valorDiaria = colaborador.dados?.valorDiaria || "";
  if (!usaDiariaColaborador(tipo) && parseValorNumericoBr(valorDiaria) <= 0) return;
  const store = aplicarCadastroNaConfigDiaria(lerDiariasColaboradores(), {
    id: colaborador.id,
    nome: colaborador.nome,
    valorDiaria,
    valorSalario: colaborador.dados?.valorSalario,
    cargaHoraria: colaborador.cargaHoraria || null,
  });
  salvarDiariasColaboradores(store);
}

export function sincronizarDiariasStoreNoCadastro(store: DiariasStore) {
  if (typeof window === "undefined") return;
  const lista = readStorage<ColaboradorStorageDiaria[]>(COLABORADORES_STORAGE_KEY, []);
  let mudou = false;
  const atualizados = lista.map((item) => {
    const id = item.id || item.nome?.trim() || "";
    const config = store.configs[id];
    if (!config) return item;
    if ((item.dados?.valorDiaria || "") === config.valorDiaria) return item;
    mudou = true;
    return {
      ...item,
      dados: {
        ...(item.dados || {}),
        valorDiaria: config.valorDiaria,
      },
    };
  });
  if (!mudou) return;
  writeStorage(COLABORADORES_STORAGE_KEY, atualizados);
  void persistirArmazenamentoImediato(COLABORADORES_STORAGE_KEY, atualizados);
}

function normalizarStore(raw: Partial<DiariasStore> | null | undefined): DiariasStore {
  const configs: Record<string, ConfigDiariaColaborador> = {};
  if (raw?.configs && typeof raw.configs === "object") {
    for (const [id, config] of Object.entries(raw.configs)) {
      if (!config?.colaboradorId) continue;
      configs[id] = {
        colaboradorId: config.colaboradorId,
        colaboradorNome: config.colaboradorNome || "",
        valorDiaria: config.valorDiaria || "0,00",
        horasJornada: Number(config.horasJornada) > 0 ? Number(config.horasJornada) : HORAS_JORNADA_PADRAO,
      };
    }
  }
  const lancamentos = Array.isArray(raw?.lancamentos)
    ? raw.lancamentos
        .filter((item) => item?.colaboradorId && /^\d{4}-\d{2}-\d{2}$/.test(item.data || ""))
        .map((item) => ({
          id: item.id || novoIdLancamento(),
          colaboradorId: item.colaboradorId,
          data: item.data,
          entrada: item.entrada || ENTRADA_PADRAO,
          saidaManha: item.saidaManha || "",
          entradaTarde: item.entradaTarde || "",
          saida: item.saida || SAIDA_PADRAO,
          intervaloMinutos: Math.max(0, Number(item.intervaloMinutos) || 0),
          horas: Number(item.horas) || 0,
          valor: Number(item.valor) || 0,
          valorManual: Boolean(item.valorManual),
          observacao: item.observacao || "",
        }))
    : [];
  const despesas: Record<string, DespesaDiariaRef> = {};
  if (raw?.despesas && typeof raw.despesas === "object") {
    for (const [chave, despesa] of Object.entries(raw.despesas)) {
      if (!despesa?.id) continue;
      despesas[chave] = {
        id: despesa.id,
        status: despesa.status,
        colaboradorId: despesa.colaboradorId,
        colaboradorNome: despesa.colaboradorNome,
        mesCompetencia: despesa.mesCompetencia,
      };
    }
  }
  return { configs, lancamentos, despesas };
}

export function lerDiariasColaboradores(): DiariasStore {
  if (typeof window === "undefined") return storeDiariasVazio();
  return normalizarStore(readStorage<Partial<DiariasStore>>(DIARIAS_STORAGE_KEY, STORE_VAZIO));
}

export function salvarDiariasColaboradores(store: DiariasStore) {
  const normalizado = normalizarStore(store);
  writeStorage(DIARIAS_STORAGE_KEY, normalizado);
  void persistirArmazenamentoImediato(DIARIAS_STORAGE_KEY, normalizado);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DIARIAS_ATUALIZADAS_EVENT));
  }
  return normalizado;
}

export function carregarColaboradoresDiaria(): ColaboradorDiariaOrigem[] {
  const lista = readStorage<ColaboradorStorageDiaria[]>(COLABORADORES_STORAGE_KEY, []);
  return lista
    .map((item) => {
      const nome = item.nome?.trim();
      if (!nome) return null;
      return {
        id: item.id || nome,
        nome,
        valorSalario: item.dados?.valorSalario || "0,00",
        valorDiaria: item.dados?.valorDiaria || "0,00",
        tipoContratacao: item.dados?.tipoContratacao || "",
        cargaHoraria: item.cargaHoraria ? clonarHorarioFuncionamento(item.cargaHoraria) : null,
      } satisfies ColaboradorDiariaOrigem;
    })
    .filter((item): item is ColaboradorDiariaOrigem => item !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function chaveMesAtual(referencia = new Date()) {
  return { ano: referencia.getFullYear(), mes: referencia.getMonth() + 1 };
}

export function dataHojeKey(referencia = new Date()) {
  return dateKeyLocal(referencia);
}
