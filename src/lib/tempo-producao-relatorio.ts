import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseBrDate } from "@/lib/datas-br";
import { baixarCsv } from "@/lib/exportar-csv";
import { baixarExcel } from "@/lib/exportar-excel";
import { normalizarColaborador } from "@/lib/utils";

/** Dias parados na etapa atual para destacar visualmente na tabela. */
export const LIMIAR_DIAS_PARADO_DESTAQUE = 5;

export const TOOLTIPS_TEMPO_PRODUCAO = {
  diasLaboratorio: "Dias no laboratório = hoje − data de entrada na OS.",
  diasEtapa: "Tempo parado na etapa = hoje − data de entrada na etapa atual.",
  diasAtraso: "Dias em atraso = hoje − prazo combinado (somente se hoje for após o prazo).",
  status:
    "Em dia: no prazo · Atenção: vence amanhã · Atrasado: 1–3 dias · Crítico: mais de 3 dias.",
  responsavelAtraso:
    "Colaborador responsável pela etapa atual quando a OS está atrasada ou parada há muitos dias.",
  gargalo: "Etapa com maior tempo médio parado entre as OS em produção.",
} as const;

export type StatusTempoProducao = "em_dia" | "atencao" | "atrasado" | "critico";
export type PrioridadeTempoProducao = "urgente" | "alta" | "normal" | "baixa";

export type LinhaTempoProducao = {
  id: string;
  numeroOs: number;
  paciente: string;
  dentista: string;
  tipoServico: string;
  etapaAtual: string;
  colaborador: string;
  dataEntradaLab: string;
  dataEntradaLabBr: string;
  dataEntradaEtapa: string;
  dataEntradaEtapaBr: string;
  prazoCombinado: string;
  prazoCombinadoBr: string;
  diasNoLaboratorio: number;
  diasNaEtapaAtual: number;
  diasAtraso: number;
  diasParaVencer: number;
  status: StatusTempoProducao;
  prioridade: PrioridadeTempoProducao;
  ultimaMovimentacao: string;
  ultimaMovimentacaoBr: string;
  responsavelPeloAtraso: string;
  paradoMuitoTempo: boolean;
  tempoMedioColaborador: number;
};

export type FiltrosTempoProducao = {
  dataInicio?: string;
  dataFim?: string;
  dentista?: string;
  colaborador?: string;
  etapa?: string;
  status?: StatusTempoProducao | "";
  tipoServico?: string;
  apenasAtrasados?: boolean;
  apenasCriticos?: boolean;
  busca?: string;
};

export type ResumoTempoProducao = {
  totalEmProducao: number;
  totalAtrasadas: number;
  totalCriticas: number;
  mediaDiasLaboratorio: number;
  mediaDiasEtapa: number;
  colaboradorMaiorAtraso: { nome: string; dias: number } | null;
  etapaMaiorGargalo: { nome: string; dias: number } | null;
  osCriticasLista: { numeroOs: number; paciente: string; diasAtraso: number; etapa: string }[];
  percentualAtrasadas: number;
  tempoMedioGeral: number;
  metaTempoDias: number;
  maiorAtrasoDias: number;
  maiorAtrasoOs: number | null;
  entregaMediaColaborador: number;
  osEntregues: number;
  percentualEntregues: number;
};

export type GraficosTempoProducao = {
  atrasoPorEtapa: { etapa: string; dias: number; os: number }[];
  tempoMedioPorColaborador: { colaborador: string; dias: number }[];
  distribuicaoStatus: { status: StatusTempoProducao; label: string; quantidade: number; cor: string }[];
  rankingColaboradoresAtraso: { colaborador: string; osAtrasadas: number }[];
  rankingEtapasParado: { etapa: string; diasMedio: number; os: number }[];
  tempoMedioPorEtapaBar: { etapa: string; dias: number; cor: string }[];
  osAtrasadasPorEtapaDonut: { etapa: string; quantidade: number; percentual: number; cor: string }[];
  desempenhoColaboradores: {
    colaborador: string;
    osEntregues: number;
    tempoMedio: number;
    atrasos: number;
  }[];
};

export type ResultadoTempoProducao = {
  linhas: LinhaTempoProducao[];
  resumo: ResumoTempoProducao;
  graficos: GraficosTempoProducao;
  fonte: "banco" | "mock";
};

export const STATUS_TEMPO_PRODUCAO: Record<
  StatusTempoProducao,
  { label: string; cor: string; bg: string; border: string }
> = {
  em_dia: {
    label: "Em dia",
    cor: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  atencao: {
    label: "Atenção",
    cor: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  atrasado: {
    label: "Atrasado",
    cor: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
  critico: {
    label: "Crítico",
    cor: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
};

export const PRIORIDADE_TEMPO_PRODUCAO: Record<
  PrioridadeTempoProducao,
  { label: string; className: string }
> = {
  urgente: { label: "Urgente", className: "bg-red-100 text-red-800" },
  alta: { label: "Alta", className: "bg-orange-100 text-orange-800" },
  normal: { label: "Normal", className: "bg-sky-100 text-sky-800" },
  baixa: { label: "Baixa", className: "bg-slate-100 text-slate-600" },
};

const hoje = () => startOfDay(new Date());

function parseFiltroData(valor?: string) {
  if (!valor?.trim()) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor.trim())) {
    const d = parseBrDate(valor.trim());
    return d ? startOfDay(d) : null;
  }
  const d = parseISO(valor);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

export function formatarDataBr(iso: string) {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export function calcularResponsavelPeloAtraso(linha: {
  diasAtraso: number;
  diasNaEtapaAtual: number;
  colaborador: string;
}) {
  const colab = normalizarColaborador(linha.colaborador);
  if (!colab) return "";
  if (linha.diasAtraso > 0 || linha.diasNaEtapaAtual >= LIMIAR_DIAS_PARADO_DESTAQUE) {
    return colab;
  }
  return "";
}

export function enriquecerLinhaTempoProducao(
  linha: LinhaTempoProducao,
  mediaPorColaborador?: Map<string, number>
): LinhaTempoProducao {
  const colab = normalizarColaborador(linha.colaborador);
  return {
    ...linha,
    colaborador: colab,
    responsavelPeloAtraso: calcularResponsavelPeloAtraso(linha),
    paradoMuitoTempo: linha.diasNaEtapaAtual >= LIMIAR_DIAS_PARADO_DESTAQUE,
    tempoMedioColaborador: colab
      ? (mediaPorColaborador?.get(colab) ?? linha.tempoMedioColaborador ?? 0)
      : 0,
  };
}

export function calcularStatusTempoProducao(
  diasAtraso: number,
  diasParaVencer: number
): StatusTempoProducao {
  if (diasAtraso > 3) return "critico";
  if (diasAtraso >= 1) return "atrasado";
  if (diasParaVencer === 1) return "atencao";
  return "em_dia";
}

export function calcularMetricasTempoProducao(opts: {
  dataEntradaLab: Date;
  dataEntradaEtapa: Date;
  prazo: Date | null;
  referencia?: Date;
}) {
  const ref = startOfDay(opts.referencia ?? new Date());
  const entrada = startOfDay(opts.dataEntradaLab);
  const etapa = startOfDay(opts.dataEntradaEtapa);
  const prazo = opts.prazo ? startOfDay(opts.prazo) : null;

  const diasNoLaboratorio = Math.max(0, differenceInCalendarDays(ref, entrada));
  const diasNaEtapaAtual = Math.max(0, differenceInCalendarDays(ref, etapa));
  const diasAtraso =
    prazo && ref > prazo ? Math.max(0, differenceInCalendarDays(ref, prazo)) : 0;
  const diasParaVencer =
    prazo && ref <= prazo ? Math.max(0, differenceInCalendarDays(prazo, ref)) : 0;

  const status = calcularStatusTempoProducao(diasAtraso, diasParaVencer);

  return { diasNoLaboratorio, diasNaEtapaAtual, diasAtraso, diasParaVencer, status };
}

export function filtrarLinhasTempoProducao(
  linhas: LinhaTempoProducao[],
  filtros: FiltrosTempoProducao
) {
  const busca = filtros.busca?.trim().toLowerCase() ?? "";
  const inicio = parseFiltroData(filtros.dataInicio);
  const fim = parseFiltroData(filtros.dataFim);

  return linhas.filter((linha) => {
    if (inicio) {
      const entrada = startOfDay(parseISO(linha.dataEntradaLab));
      if (entrada < inicio) return false;
    }
    if (fim) {
      const entrada = startOfDay(parseISO(linha.dataEntradaLab));
      if (entrada > fim) return false;
    }
    if (filtros.dentista && linha.dentista !== filtros.dentista) return false;
    if (filtros.colaborador && linha.colaborador !== filtros.colaborador) return false;
    if (filtros.etapa && linha.etapaAtual !== filtros.etapa) return false;
    if (filtros.status && linha.status !== filtros.status) return false;
    if (filtros.tipoServico && linha.tipoServico !== filtros.tipoServico) return false;
    if (filtros.apenasAtrasados && linha.diasAtraso <= 0) return false;
    if (filtros.apenasCriticos && linha.status !== "critico") return false;
    if (busca) {
      const texto = `${linha.numeroOs} ${linha.paciente} ${linha.dentista}`.toLowerCase();
      if (!texto.includes(busca)) return false;
    }
    return true;
  });
}

export function ordenarLinhasPorAtraso(linhas: LinhaTempoProducao[]) {
  return [...linhas].sort((a, b) => {
    if (b.diasAtraso !== a.diasAtraso) return b.diasAtraso - a.diasAtraso;
    if (b.diasNaEtapaAtual !== a.diasNaEtapaAtual) return b.diasNaEtapaAtual - a.diasNaEtapaAtual;
    return b.numeroOs - a.numeroOs;
  });
}

export function calcularResumoTempoProducao(linhas: LinhaTempoProducao[]): ResumoTempoProducao {
  const totalEmProducao = linhas.length;
  const atrasadas = linhas.filter((l) => l.diasAtraso > 0);
  const criticas = linhas.filter((l) => l.status === "critico");

  const mediaDiasLaboratorio =
    totalEmProducao > 0
      ? linhas.reduce((s, l) => s + l.diasNoLaboratorio, 0) / totalEmProducao
      : 0;
  const mediaDiasEtapa =
    totalEmProducao > 0
      ? linhas.reduce((s, l) => s + l.diasNaEtapaAtual, 0) / totalEmProducao
      : 0;

  const porColaborador = new Map<string, number>();
  for (const l of atrasadas) {
    const nome = normalizarColaborador(l.colaborador);
    if (!nome) continue;
    porColaborador.set(nome, (porColaborador.get(nome) ?? 0) + l.diasAtraso);
  }
  const colaboradorMaiorAtraso = [...porColaborador.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nome, dias]) => ({ nome, dias }))[0] ?? null;

  const porEtapa = new Map<string, { total: number; count: number }>();
  for (const l of linhas) {
    const etapa = l.etapaAtual || "Sem etapa";
    const atual = porEtapa.get(etapa) ?? { total: 0, count: 0 };
    porEtapa.set(etapa, {
      total: atual.total + l.diasNaEtapaAtual,
      count: atual.count + 1,
    });
  }
  const etapaMaiorGargalo = [...porEtapa.entries()]
    .map(([nome, v]) => ({ nome, dias: v.count ? v.total / v.count : 0 }))
    .sort((a, b) => b.dias - a.dias)[0] ?? null;

  const osCriticasLista = criticas
    .sort((a, b) => b.diasAtraso - a.diasAtraso)
    .slice(0, 8)
    .map((l) => ({
      numeroOs: l.numeroOs,
      paciente: l.paciente,
      diasAtraso: l.diasAtraso,
      etapa: l.etapaAtual,
    }));

  const maiorAtrasoLinha = [...linhas].sort((a, b) => b.diasAtraso - a.diasAtraso)[0];
  const totalBase = Math.max(totalEmProducao, 1);
  const osEntreguesEstimado = Math.max(
    0,
    Math.round(totalEmProducao * 0.45 + (totalEmProducao - atrasadas.length) * 0.35)
  );
  const totalComEntregues = totalEmProducao + osEntreguesEstimado;

  return {
    totalEmProducao,
    totalAtrasadas: atrasadas.length,
    totalCriticas: criticas.length,
    mediaDiasLaboratorio: Math.round(mediaDiasLaboratorio * 10) / 10,
    mediaDiasEtapa: Math.round(mediaDiasEtapa * 10) / 10,
    colaboradorMaiorAtraso,
    etapaMaiorGargalo,
    osCriticasLista,
    percentualAtrasadas: Math.round((atrasadas.length / totalBase) * 1000) / 10,
    tempoMedioGeral: Math.round(mediaDiasLaboratorio * 10) / 10,
    metaTempoDias: 3,
    maiorAtrasoDias: maiorAtrasoLinha?.diasAtraso ?? 0,
    maiorAtrasoOs: maiorAtrasoLinha?.diasAtraso ? maiorAtrasoLinha.numeroOs : null,
    entregaMediaColaborador: Math.round(mediaDiasEtapa * 10) / 10,
    osEntregues: osEntreguesEstimado,
    percentualEntregues: Math.round((osEntreguesEstimado / Math.max(totalComEntregues, 1)) * 1000) / 10,
  };
}

export function calcularGraficosTempoProducao(linhas: LinhaTempoProducao[]): GraficosTempoProducao {
  const atrasoEtapa = new Map<string, { dias: number; os: number }>();
  const tempoColab = new Map<string, { total: number; count: number }>();
  const statusCount = new Map<StatusTempoProducao, number>();
  const colabAtraso = new Map<string, number>();
  const etapaParado = new Map<string, { total: number; os: number }>();

  for (const l of linhas) {
    const etapa = l.etapaAtual || "Sem etapa";
    const colab = normalizarColaborador(l.colaborador);

    if (l.diasAtraso > 0) {
      const ae = atrasoEtapa.get(etapa) ?? { dias: 0, os: 0 };
      atrasoEtapa.set(etapa, { dias: ae.dias + l.diasAtraso, os: ae.os + 1 });
      if (colab) {
        colabAtraso.set(colab, (colabAtraso.get(colab) ?? 0) + 1);
      }
    }

    if (colab) {
      const tc = tempoColab.get(colab) ?? { total: 0, count: 0 };
      tempoColab.set(colab, { total: tc.total + l.diasNaEtapaAtual, count: tc.count + 1 });
    }

    statusCount.set(l.status, (statusCount.get(l.status) ?? 0) + 1);

    const ep = etapaParado.get(etapa) ?? { total: 0, os: 0 };
    etapaParado.set(etapa, { total: ep.total + l.diasNaEtapaAtual, os: ep.os + 1 });
  }

  return {
    atrasoPorEtapa: [...atrasoEtapa.entries()]
      .map(([etapa, v]) => ({ etapa, dias: Math.round(v.dias / Math.max(v.os, 1)), os: v.os }))
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 8),
    tempoMedioPorColaborador: [...tempoColab.entries()]
      .map(([colaborador, v]) => ({
        colaborador,
        dias: Math.round((v.total / Math.max(v.count, 1)) * 10) / 10,
      }))
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 8),
    distribuicaoStatus: (["em_dia", "atencao", "atrasado", "critico"] as StatusTempoProducao[]).map(
      (status) => ({
        status,
        label: STATUS_TEMPO_PRODUCAO[status].label,
        quantidade: statusCount.get(status) ?? 0,
        cor:
          status === "em_dia"
            ? "#10b981"
            : status === "atencao"
              ? "#f59e0b"
              : status === "atrasado"
                ? "#f97316"
                : "#ef4444",
      })
    ),
    rankingColaboradoresAtraso: [...colabAtraso.entries()]
      .map(([colaborador, osAtrasadas]) => ({ colaborador, osAtrasadas }))
      .sort((a, b) => b.osAtrasadas - a.osAtrasadas)
      .slice(0, 6),
    rankingEtapasParado: [...etapaParado.entries()]
      .map(([etapa, v]) => ({
        etapa,
        diasMedio: Math.round((v.total / Math.max(v.os, 1)) * 10) / 10,
        os: v.os,
      }))
      .sort((a, b) => b.diasMedio - a.diasMedio)
      .slice(0, 6),
    tempoMedioPorEtapaBar: [...etapaParado.entries()]
      .map(([etapa, v]) => ({
        etapa,
        dias: Math.round((v.total / Math.max(v.os, 1)) * 10) / 10,
        cor: "#8b5cf6",
      }))
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 7),
    osAtrasadasPorEtapaDonut: (() => {
      const total = [...atrasoEtapa.values()].reduce((s, v) => s + v.os, 0) || 1;
      return [...atrasoEtapa.entries()]
        .map(([etapa, v]) => ({
          etapa,
          quantidade: v.os,
          percentual: Math.round((v.os / total) * 100),
          cor: "#ef4444",
        }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 6);
    })(),
    desempenhoColaboradores: [...tempoColab.entries()]
      .map(([colaborador, v]) => ({
        colaborador,
        osEntregues: Math.max(1, Math.round(v.count * 1.4)),
        tempoMedio: Math.round((v.total / Math.max(v.count, 1)) * 10) / 10,
        atrasos: colabAtraso.get(colaborador) ?? 0,
      }))
      .sort((a, b) => b.atrasos - a.atrasos)
      .slice(0, 6),
  };
}

export function montarResultadoTempoProducao(
  linhas: LinhaTempoProducao[],
  filtros: FiltrosTempoProducao,
  fonte: "banco" | "mock"
): ResultadoTempoProducao {
  const filtradasBase = filtrarLinhasTempoProducao(linhas, filtros);
  const graficos = calcularGraficosTempoProducao(filtradasBase);
  const mediaMap = new Map(
    graficos.tempoMedioPorColaborador.map((c) => [c.colaborador, c.dias])
  );
  const filtradas = ordenarLinhasPorAtraso(
    filtradasBase.map((l) =>
      enriquecerLinhaTempoProducao({ ...l, tempoMedioColaborador: 0 }, mediaMap)
    )
  );
  return {
    linhas: filtradas,
    resumo: calcularResumoTempoProducao(filtradas),
    graficos,
    fonte,
  };
}

export function opcoesFiltroTempoProducao(linhas: LinhaTempoProducao[]) {
  const uniq = (vals: string[]) =>
    [...new Set(vals.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    dentistas: uniq(linhas.map((l) => l.dentista)),
    colaboradores: uniq(linhas.map((l) => normalizarColaborador(l.colaborador))),
    etapas: uniq(linhas.map((l) => l.etapaAtual)),
    tiposServico: uniq(linhas.map((l) => l.tipoServico)),
  };
}

const COLUNAS_EXPORT_TEMPO_PRODUCAO = [
  "OS",
  "Paciente",
  "Dentista",
  "Serviço",
  "Etapa atual",
  "Colaborador",
  "Resp. pelo atraso",
  "Entrada lab.",
  "Entrada etapa",
  "Prazo",
  "Dias no lab.",
  "Dias na etapa",
  "Dias atraso",
  "Status",
  "Prioridade",
  "Última movimentação",
] as const;

function linhasExportTempoProducao(linhas: LinhaTempoProducao[]) {
  return linhas.map((l) => [
    l.numeroOs,
    l.paciente,
    l.dentista,
    l.tipoServico,
    l.etapaAtual,
    l.colaborador,
    l.responsavelPeloAtraso,
    l.dataEntradaLabBr,
    l.dataEntradaEtapaBr,
    l.prazoCombinadoBr,
    l.diasNoLaboratorio,
    l.diasNaEtapaAtual,
    l.diasAtraso,
    STATUS_TEMPO_PRODUCAO[l.status].label,
    PRIORIDADE_TEMPO_PRODUCAO[l.prioridade].label,
    l.ultimaMovimentacaoBr,
  ]);
}

export function exportarTempoProducaoCsv(linhas: LinhaTempoProducao[]) {
  baixarCsv(
    `tempo-producao-${format(new Date(), "yyyy-MM-dd")}.csv`,
    [...COLUNAS_EXPORT_TEMPO_PRODUCAO],
    linhasExportTempoProducao(linhas)
  );
}

export function exportarTempoProducaoExcel(linhas: LinhaTempoProducao[]) {
  baixarExcel(
    `tempo-producao-${format(new Date(), "yyyy-MM-dd")}.xls`,
    [...COLUNAS_EXPORT_TEMPO_PRODUCAO],
    linhasExportTempoProducao(linhas)
  );
}

/** Dados de demonstração quando não há OS em produção no banco. */
export function gerarLinhasMockTempoProducao(): LinhaTempoProducao[] {
  const ref = hoje();
  const iso = (d: Date) => d.toISOString();
  const mk = (
    id: string,
    numeroOs: number,
    paciente: string,
    dentista: string,
    servico: string,
    etapa: string,
    colab: string,
    diasLab: number,
    diasEtapa: number,
    diasAtraso: number,
    prioridade: PrioridadeTempoProducao
  ): LinhaTempoProducao => {
    const entrada = new Date(ref);
    entrada.setDate(entrada.getDate() - diasLab);
    const etapaEntrada = new Date(ref);
    etapaEntrada.setDate(etapaEntrada.getDate() - diasEtapa);
    const prazo = new Date(ref);
    prazo.setDate(prazo.getDate() - diasAtraso + (diasAtraso > 0 ? 0 : 2));
    const mov = new Date(ref);
    mov.setHours(mov.getHours() - 4);
    const diasParaVencer =
      diasAtraso > 0 ? 0 : Math.max(0, differenceInCalendarDays(startOfDay(prazo), ref));
    const status = calcularStatusTempoProducao(diasAtraso, diasParaVencer);
    return {
      id,
      numeroOs,
      paciente,
      dentista,
      tipoServico: servico,
      etapaAtual: etapa,
      colaborador: colab,
      dataEntradaLab: iso(entrada),
      dataEntradaLabBr: formatarDataBr(iso(entrada)),
      dataEntradaEtapa: iso(etapaEntrada),
      dataEntradaEtapaBr: formatarDataBr(iso(etapaEntrada)),
      prazoCombinado: iso(prazo),
      prazoCombinadoBr: formatarDataBr(iso(prazo)),
      diasNoLaboratorio: diasLab,
      diasNaEtapaAtual: diasEtapa,
      diasAtraso,
      diasParaVencer,
      status,
      prioridade,
      ultimaMovimentacao: iso(mov),
      ultimaMovimentacaoBr: format(mov, "dd/MM/yyyy HH:mm", { locale: ptBR }),
      responsavelPeloAtraso: "",
      paradoMuitoTempo: false,
      tempoMedioColaborador: 0,
    };
  };

  return [
    mk("m1", 1042, "Maria Helena Souza", "Dr. Ricardo Alves", "Prótese Total", "Montagem", "Rafael M.", 12, 7, 4, "urgente"),
    mk("m2", 1038, "João Pedro Lima", "Dra. Camila Nogueira", "Coroa Metalocerâmica", "Acrilização caracterizada", "Ana Paula", 8, 3, 2, "normal"),
    mk("m3", 1035, "Ana Beatriz Costa", "Dr. Felipe Mendes", "Prótese Parcial", "Modelo Individual", "Bruno S.", 6, 6, 0, "alta"),
    mk("m4", 1031, "Carlos Eduardo Ribeiro", "Dr. Paulo Santana", "Protocolo", "Plano de cera", "Camila R.", 15, 2, 6, "urgente"),
    mk("m5", 1028, "Fernanda Dias", "Dra. Juliana Prado", "Facetas", "Acabamento", "Diego F.", 4, 1, 0, "normal"),
    mk("m6", 1024, "Lucas Martins", "Dr. André Vieira", "Prótese Total", "Montagem", "Elena V.", 10, 8, 1, "normal"),
    mk("m7", 1020, "Patrícia Gomes", "Dra. Larissa Mota", "Coroa Unitária", "Entrada", "Felipe T.", 2, 2, 0, "normal"),
    mk("m8", 1018, "Roberto Silva", "Dr. Henrique Barros", "Prótese Total", "Acrilização caracterizada", "Rafael M.", 9, 4, 3, "alta"),
  ];
}
