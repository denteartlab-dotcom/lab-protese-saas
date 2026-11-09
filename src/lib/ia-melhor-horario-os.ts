import { parseBrDate } from "@/lib/datas-br";
import {
  HORARIO_FUNCIONAMENTO_PADRAO,
  type HorarioFuncionamentoConfig,
} from "@/lib/horario-funcionamento";
import { parseDiasPrazo } from "@/lib/prazos-servico";

const IDS_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;
const MINUTOS_SEM_CADASTRO = 60;

export type EtapaEntradaPlano = {
  nome: string;
  setor?: string;
  /** Minutos já calculados (tempo médio × dentes, quando a etapa pede isso). */
  minutos?: number;
  prazoDias?: string | null;
};

export type EntradaPlanoHorarioOs = {
  agora?: Date;
  dataLancamento: string;
  paciente?: string;
  cliente?: string;
  dentista?: string;
  servico?: string;
  dentes?: string;
  quantidadeDentes?: number;
  observacoes?: string;
  casoClinico?: string;
  urgente?: boolean;
  repeticao?: boolean;
  prioridade?: string;
  prazoTabelaDias?: string | null;
  prazoDentistaDias?: string | null;
  horario?: HorarioFuncionamentoConfig | null;
  etapas: EtapaEntradaPlano[];
  /** Entregas já marcadas por dia (dd/mm/aaaa), sem contar esta OS. */
  ocupacaoPorDia?: Record<string, number>;
};

export type EtapaPlanejada = {
  nome: string;
  setor: string;
  minutos: number;
  tempoTexto: string;
  inicioData: string;
  inicioHora: string;
  data: string;
  hora: string;
  ideia: string;
  tempoEstimado: boolean;
};

export type PlanoHorarioOs = {
  descricao: string;
  urgente: boolean;
  motivoUrgencia: string;
  ideias: string[];
  etapas: EtapaPlanejada[];
  inicioData: string;
  inicioHora: string;
  prazoLaboratorio: { data: string; hora: string };
  prazoDentista: { data: string; hora: string };
  avisoPrazo: string;
  cargaDia: string;
};

type Instante = { date: Date; minuto: number };

function formatarData(date: Date) {
  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${date.getFullYear()}`;
}

function formatarHora(minutos: number) {
  const total = Math.max(0, Math.round(minutos));
  const hora = Math.floor(total / 60);
  const minuto = total % 60;
  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

function textoTempo(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!resto) return horas === 1 ? "1 h" : `${horas} h`;
  return `${horas} h ${resto} min`;
}

function mesmoDia(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function adicionarDias(date: Date, dias: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dias);
}

function diferencaDias(fim: Date, limite: Date) {
  const a = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();
  const b = new Date(limite.getFullYear(), limite.getMonth(), limite.getDate()).getTime();
  return Math.round((a - b) / 86400000);
}

function minutosRelogio(valor?: string) {
  const match = (valor || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hora = Number(match[1]);
  const minuto = Number(match[2]);
  if (hora > 23 || minuto > 59) return null;
  return hora * 60 + minuto;
}

function isoDoDia(date: Date) {
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mes}-${dia}`;
}

function horarioEfetivo(horario?: HorarioFuncionamentoConfig | null) {
  if (horario?.dias?.length) return horario;
  return HORARIO_FUNCIONAMENTO_PADRAO;
}

function diaAberto(date: Date, horario: HorarioFuncionamentoConfig) {
  const id = IDS_SEMANA[date.getDay()];
  const dia = horario.dias.find((item) => item.id === id);
  if (!dia?.ativo) return null;
  if (horario.feriados.some((feriado) => feriado.data === isoDoDia(date))) return null;
  const inicio = minutosRelogio(dia.inicio);
  const fim = minutosRelogio(dia.fim);
  if (inicio == null || fim == null || fim - inicio < 15) return null;
  return dia;
}

function janelasDoDia(date: Date, horario: HorarioFuncionamentoConfig): Array<[number, number]> {
  const dia = diaAberto(date, horario);
  if (!dia) return [];
  const inicio = minutosRelogio(dia.inicio);
  const fim = minutosRelogio(dia.fim);
  if (inicio == null || fim == null) return [];
  let janelas: Array<[number, number]> = [[inicio, fim]];
  for (const intervalo of dia.intervalos || []) {
    const a = minutosRelogio(intervalo.inicio);
    const b = minutosRelogio(intervalo.fim);
    if (a == null || b == null || b <= a) continue;
    const proximas: Array<[number, number]> = [];
    for (const [ini, end] of janelas) {
      if (b <= ini || a >= end) {
        proximas.push([ini, end]);
        continue;
      }
      if (a > ini) proximas.push([ini, a]);
      if (b < end) proximas.push([b, end]);
    }
    janelas = proximas.filter(([ini, end]) => end - ini >= 1);
  }
  return janelas;
}

function proximoInstante(date: Date, minuto: number, horario: HorarioFuncionamentoConfig): Instante | null {
  const limite = adicionarDias(date, 120);
  let cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let minutoCursor = minuto;
  while (cursor <= limite) {
    for (const [ini, fim] of janelasDoDia(cursor, horario)) {
      if (minutoCursor < fim) {
        return { date: cursor, minuto: Math.max(minutoCursor, ini) };
      }
    }
    cursor = adicionarDias(cursor, 1);
    minutoCursor = 0;
  }
  return null;
}

function somarMinutosUteis(inicio: Instante, minutos: number, horario: HorarioFuncionamentoConfig): Instante | null {
  let cursor = proximoInstante(inicio.date, inicio.minuto, horario);
  let restante = Math.max(1, minutos);
  while (cursor && restante > 0) {
    const janela = janelasDoDia(cursor.date, horario).find(
      ([ini, fim]) => cursor!.minuto >= ini && cursor!.minuto < fim
    );
    if (!janela) {
      cursor = proximoInstante(cursor.date, cursor.minuto, horario);
      continue;
    }
    const cabe = janela[1] - cursor.minuto;
    if (restante <= cabe) {
      return { date: cursor.date, minuto: cursor.minuto + restante };
    }
    restante -= cabe;
    cursor = proximoInstante(cursor.date, janela[1], horario);
  }
  return cursor;
}

function diaUtilAnterior(date: Date, horario: HorarioFuncionamentoConfig) {
  let cursor = adicionarDias(date, -1);
  for (let i = 0; i < 21; i += 1) {
    if (janelasDoDia(cursor, horario).length) return cursor;
    cursor = adicionarDias(cursor, -1);
  }
  return date;
}

function trabalhoUrgente(entrada: EntradaPlanoHorarioOs) {
  const texto = `${entrada.observacoes || ""} ${entrada.casoClinico || ""}`.toLowerCase();
  if (entrada.urgente) return "O serviço foi marcado como urgente.";
  if ((entrada.prioridade || "").toLowerCase() === "alta") return "A prioridade da ordem está alta.";
  if (/urg[eê]n/.test(texto)) return "A observação ou o caso clínico pedem urgência.";
  return "";
}

function descreverTrabalho(entrada: EntradaPlanoHorarioOs, urgente: boolean) {
  const partes = [
    entrada.servico?.trim()
      ? `Serviço ${entrada.servico.trim()}`
      : "Serviço sem nome",
    entrada.paciente?.trim() ? `paciente ${entrada.paciente.trim()}` : "",
    entrada.cliente?.trim() ? `cliente ${entrada.cliente.trim()}` : "",
    entrada.dentista?.trim() ? `dentista ${entrada.dentista.trim()}` : "",
  ].filter(Boolean);
  const dentes =
    entrada.dentes?.trim() && entrada.dentes.trim() !== "-"
      ? ` Dentes: ${entrada.dentes.trim()}.`
      : entrada.quantidadeDentes
        ? ` Quantidade considerada: ${entrada.quantidadeDentes}.`
        : "";
  const caso = entrada.casoClinico?.trim() ? ` Caso clínico: ${entrada.casoClinico.trim()}.` : "";
  const obs = entrada.observacoes?.trim()
    ? ` Observação: ${entrada.observacoes.trim()}.`
    : "";
  const ritmo = urgente
    ? " A ordem entra como urgência e deve seguir sem espera entre as etapas."
    : " A ordem segue o ritmo normal do laboratório, encaixada no dia com menos entregas.";
  const lancamento = entrada.dataLancamento.trim()
    ? ` Entrada em ${entrada.dataLancamento.trim()}.`
    : "";
  return `${partes.join(", ")}.${lancamento}${dentes}${caso}${obs}${ritmo}`;
}

function simular(inicio: Instante, entrada: EntradaPlanoHorarioOs, horario: HorarioFuncionamentoConfig) {
  const etapas: EtapaPlanejada[] = [];
  let cursor = inicio;
  let setorAnterior = "";
  for (const etapa of entrada.etapas) {
    const nome = etapa.nome.trim();
    if (!nome) continue;
    const estimado = !etapa.minutos || etapa.minutos <= 0;
    const minutos = estimado ? MINUTOS_SEM_CADASTRO : Math.round(etapa.minutos!);
    const comeco = proximoInstante(cursor.date, cursor.minuto, horario);
    if (!comeco) return null;
    const fim = somarMinutosUteis(comeco, minutos, horario);
    if (!fim) return null;
    const setor = etapa.setor?.trim() || "Setor não informado";
    const trocaSetor = Boolean(setorAnterior && setorAnterior !== setor);
    const ideia = [
      estimado
        ? "Esta etapa não tem tempo médio cadastrado; contei 1 h para não deixar o prazo folgado demais."
        : `Reserve ${textoTempo(minutos)} contínuos.`,
      trocaSetor
        ? `Assim que terminar, passe a peça de ${setorAnterior} para ${setor}.`
        : `Faça esta etapa inteira em ${setor} antes de liberar a próxima.`,
      minutos >= 180
        ? "É uma etapa longa: comece no início do expediente para não cortar no fim do dia."
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    etapas.push({
      nome,
      setor,
      minutos,
      tempoTexto: textoTempo(minutos),
      inicioData: formatarData(comeco.date),
      inicioHora: formatarHora(comeco.minuto),
      data: formatarData(fim.date),
      hora: formatarHora(fim.minuto),
      ideia,
      tempoEstimado: estimado,
    });
    cursor = fim;
    setorAnterior = setor;
  }
  if (!etapas.length) return null;
  return { etapas, fim: cursor };
}

function candidatosInicio(entrada: EntradaPlanoHorarioOs, horario: HorarioFuncionamentoConfig, agora: Date) {
  const lancamento = parseBrDate(entrada.dataLancamento.trim()) || new Date(agora);
  const base = new Date(lancamento.getFullYear(), lancamento.getMonth(), lancamento.getDate());
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const primeira = base > hoje ? base : hoje;
  const lista: Instante[] = [];
  let cursor = primeira;
  for (let i = 0; i < 40 && lista.length < 12; i += 1) {
    const instante = proximoInstante(cursor, 0, horario);
    if (!instante) break;
    if (mesmoDia(instante.date, hoje)) {
      const minutoAgora = agora.getHours() * 60 + agora.getMinutes();
      const aindaHoje = proximoInstante(hoje, minutoAgora, horario);
      if (aindaHoje && mesmoDia(aindaHoje.date, hoje)) lista.push(aindaHoje);
    } else if (instante.date >= primeira) {
      const abertura = janelasDoDia(instante.date, horario)[0];
      if (abertura) lista.push({ date: instante.date, minuto: abertura[0] });
    }
    cursor = adicionarDias(instante.date, 1);
  }
  return lista;
}

export function planejarMelhorHorarioOs(entrada: EntradaPlanoHorarioOs): PlanoHorarioOs | null {
  const horario = horarioEfetivo(entrada.horario);
  const agora = entrada.agora || new Date();
  const motivoUrgencia = trabalhoUrgente(entrada);
  const urgente = Boolean(motivoUrgencia);
  const inicios = candidatosInicio(entrada, horario, agora);
  if (!inicios.length) return null;

  const diasTabela = parseDiasPrazo(entrada.prazoTabelaDias);
  const limiteTabela = diasTabela
    ? parseBrDate(
        formatarData(
          adicionarDias(parseBrDate(entrada.dataLancamento.trim()) || agora, diasTabela)
        )
      )
    : null;

  let melhor: { inicio: Instante; etapas: EtapaPlanejada[]; fim: Instante; nota: number } | null =
    null;

  for (const inicio of inicios) {
    const simulado = simular(inicio, entrada, horario);
    if (!simulado) continue;
    const atraso = limiteTabela ? Math.max(0, diferencaDias(simulado.fim.date, limiteTabela)) : 0;
    const carga = entrada.ocupacaoPorDia?.[formatarData(simulado.fim.date)] || 0;
    const nota = urgente
      ? atraso * 100000 + simulado.fim.date.getTime() / 60000 + simulado.fim.minuto + carga
      : atraso * 100000 + carga * 1000 + simulado.fim.date.getTime() / 86400000;
    if (!melhor || nota < melhor.nota) {
      melhor = { inicio, etapas: simulado.etapas, fim: simulado.fim, nota };
    }
    if (urgente && melhor) break;
  }

  if (!melhor) return null;

  const fimData = formatarData(melhor.fim.date);
  const fimHora = formatarHora(melhor.fim.minuto);
  const diasAntes = parseDiasPrazo(entrada.prazoDentistaDias);
  let dataDentista = "";
  let horaDentista = "";
  if (diasAntes > 0) {
    let dentista = adicionarDias(melhor.fim.date, -diasAntes);
    if (!janelasDoDia(dentista, horario).length) dentista = diaUtilAnterior(dentista, horario);
    const lancamento = parseBrDate(entrada.dataLancamento.trim());
    if (lancamento && dentista < lancamento) dentista = lancamento;
    if (!janelasDoDia(dentista, horario).length) {
      dentista = proximoInstante(dentista, 0, horario)?.date || dentista;
    }
    dataDentista = formatarData(dentista);
    const abertura = janelasDoDia(dentista, horario)[0];
    horaDentista = formatarHora(abertura ? abertura[0] : melhor.inicio.minuto);
  }

  const carga = entrada.ocupacaoPorDia?.[fimData] || 0;
  const atrasoTabela = limiteTabela ? diferencaDias(melhor.fim.date, limiteTabela) : 0;
  const avisoPrazo =
    limiteTabela && atrasoTabela > 0
      ? `A tabela previa ${formatarData(limiteTabela)}, mas a soma das etapas só termina em ${fimData} às ${fimHora}. Este é o primeiro horário que não atrasa o trabalho real.`
      : limiteTabela
        ? `A tabela previa ${formatarData(limiteTabela)}. O cronograma termina em ${fimData} às ${fimHora}, dentro desse prazo.`
        : `A tabela deste serviço não tem prazo em dias. O término ficou em ${fimData} às ${fimHora}, pelo tempo de cada etapa.`;

  const cargaDia =
    carga === 0
      ? `${fimData} ainda não tem outra entrega marcada. É o dia mais folgado para não empurrar esta ordem.`
      : `${fimData} já tem ${carga} entrega${carga === 1 ? "" : "s"} marcada${carga === 1 ? "" : "s"}. Entre os dias que cabem no prazo, este é o menos carregado.`;

  const ideias = [
    urgente
      ? "Comece no primeiro horário útil e não deixe a peça parada entre um setor e outro."
      : "Encaixe o início no dia em que a entrega final encontra a agenda mais livre.",
    `Siga esta ordem: ${melhor.etapas.map((etapa) => etapa.nome).join(" → ")}.`,
    entrada.repeticao
      ? "É repetição: confira o que já foi feito antes de refazer etapa."
      : "",
    melhor.etapas.some((etapa) => etapa.tempoEstimado)
      ? "Cadastre o tempo médio das etapas sem cronômetro para o cálculo ficar exato."
      : "Os tempos saíram do cadastro de cada etapa, no expediente do laboratório.",
    avisoPrazo,
  ].filter(Boolean);

  return {
    descricao: descreverTrabalho(entrada, urgente),
    urgente,
    motivoUrgencia: motivoUrgencia || "Nenhum sinal de urgência na ordem.",
    ideias,
    etapas: melhor.etapas,
    inicioData: formatarData(melhor.inicio.date),
    inicioHora: formatarHora(melhor.inicio.minuto),
    prazoLaboratorio: { data: fimData, hora: fimHora },
    prazoDentista: { data: dataDentista, hora: horaDentista },
    avisoPrazo,
    cargaDia,
  };
}

export function prazosEtapasDoPlano<T extends { nome: string; prazo: string }>(
  etapas: T[],
  plano: PlanoHorarioOs
) {
  let indice = 0;
  return etapas.map((etapa) => {
    if (!etapa.nome.trim()) return etapa;
    const planejada = plano.etapas[indice];
    indice += 1;
    if (!planejada) return etapa;
    return { ...etapa, prazo: `${planejada.data} ${planejada.hora}` };
  });
}
