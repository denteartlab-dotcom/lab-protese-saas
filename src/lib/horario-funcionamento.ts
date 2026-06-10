import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const HORARIO_FUNCIONAMENTO_STORAGE_KEY = "labProteseHorarioFuncionamento";

export type IntervaloDia = {
  id: string;
  inicio: string;
  fim: string;
};

export type DiaFuncionamento = {
  id: string;
  label: string;
  ativo: boolean;
  inicio: string;
  fim: string;
  intervalos: IntervaloDia[];
};

export type FeriadoLab = {
  id: string;
  data: string;
  descricao: string;
};

export type HorarioFuncionamentoConfig = {
  dias: DiaFuncionamento[];
  feriados: FeriadoLab[];
};

function novoIntervalo(inicio = "12:00", fim = "13:00"): IntervaloDia {
  return {
    id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    inicio,
    fim,
  };
}

export const DIAS_SEMANA_PADRAO: Omit<DiaFuncionamento, "intervalos">[] = [
  { id: "segunda", label: "Segunda", ativo: true, inicio: "08:00", fim: "18:00" },
  { id: "terca", label: "Terça", ativo: true, inicio: "08:00", fim: "18:00" },
  { id: "quarta", label: "Quarta", ativo: true, inicio: "08:00", fim: "18:00" },
  { id: "quinta", label: "Quinta", ativo: true, inicio: "08:00", fim: "18:00" },
  { id: "sexta", label: "Sexta", ativo: true, inicio: "08:00", fim: "18:00" },
  { id: "sabado", label: "Sábado", ativo: false, inicio: "08:00", fim: "12:00" },
  { id: "domingo", label: "Domingo", ativo: false, inicio: "", fim: "" },
];

export const HORARIO_FUNCIONAMENTO_PADRAO: HorarioFuncionamentoConfig = {
  dias: DIAS_SEMANA_PADRAO.map((d) => ({
    ...d,
    intervalos: [],
  })),
  feriados: [],
};

function normalizarDias(parsed?: DiaFuncionamento[]): DiaFuncionamento[] {
  const mapa = new Map((parsed || []).map((d) => [d.id, d]));
  return DIAS_SEMANA_PADRAO.map((base) => {
    const salvo = mapa.get(base.id);
    if (!salvo) {
      return {
        ...base,
        intervalos: [],
      };
    }
    return {
      ...base,
      ativo: Boolean(salvo.ativo),
      inicio: salvo.inicio ?? base.inicio,
      fim: salvo.fim ?? base.fim,
      intervalos: Array.isArray(salvo.intervalos)
        ? salvo.intervalos.map((i) => ({
            id: i.id || novoIntervalo().id,
            inicio: i.inicio || "12:00",
            fim: i.fim || "13:00",
          }))
        : [],
    };
  });
}

export function carregarHorarioFuncionamento(): HorarioFuncionamentoConfig {
  if (typeof window === "undefined") return HORARIO_FUNCIONAMENTO_PADRAO;
  try {
    const parsed = readStorage<Partial<HorarioFuncionamentoConfig> | null>(
      HORARIO_FUNCIONAMENTO_STORAGE_KEY,
      null
    );
    if (!parsed) return HORARIO_FUNCIONAMENTO_PADRAO;
    return {
      dias: normalizarDias(parsed.dias),
      feriados: Array.isArray(parsed.feriados) ? parsed.feriados : [],
    };
  } catch {
    return HORARIO_FUNCIONAMENTO_PADRAO;
  }
}

export function salvarHorarioFuncionamento(config: HorarioFuncionamentoConfig) {
  if (typeof window === "undefined") return;
  writeStorage(HORARIO_FUNCIONAMENTO_STORAGE_KEY, config);
}

export function criarIntervalo(inicio?: string, fim?: string): IntervaloDia {
  return novoIntervalo(inicio, fim);
}

export function clonarHorarioFuncionamento(
  base?: HorarioFuncionamentoConfig | null
): HorarioFuncionamentoConfig {
  const src = base
    ? { dias: normalizarDias(base.dias), feriados: Array.isArray(base.feriados) ? base.feriados : [] }
    : HORARIO_FUNCIONAMENTO_PADRAO;
  return JSON.parse(JSON.stringify(src)) as HorarioFuncionamentoConfig;
}
