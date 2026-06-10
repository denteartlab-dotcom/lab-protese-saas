import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  parseComplementosInstrucoesGrupo,
  tempoMinutosEtapa,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import { indiceEtapaAtualDeConcluidas } from "@/lib/modulo-producao-etapas";
import { anexosFromInstrucoes } from "@/lib/os-anexos";
import {
  calcularMetricasTempoProducao,
  formatarDataBr,
  type LinhaTempoProducao,
  type PrioridadeTempoProducao,
  type StatusTempoProducao,
} from "@/lib/tempo-producao-relatorio";

export type SituacaoEtapaTimeline = "concluida" | "atual" | "aguardando";

export type EtapaTimelineOs = {
  indice: number;
  nome: string;
  situacao: SituacaoEtapaTimeline;
  responsavel: string;
  entradaIso: string | null;
  entradaBr: string;
  saidaIso: string | null;
  saidaBr: string;
  diasNaEtapa: number | null;
  horasNaEtapa: number | null;
  tempoPrevisto: string;
  observacao: string;
  estimado: boolean;
};

export type DetalheTempoProducaoOs = {
  resumo: LinhaTempoProducao;
  timeline: EtapaTimelineOs[];
  observacoes: string;
  observacoesInternas: string;
  anexos: { name: string; type: string; url: string }[];
  fonte: "banco" | "mock";
};

type TrabalhoDetalheInput = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  status: string;
  observacoes?: string | null;
  instrucoes?: string | null;
  dataEntrada: Date;
  dataPrevista?: Date | null;
  updatedAt: Date;
  cliente: { nome: string };
  paciente: { nome: string };
};

function formatarDataHoraBr(iso: string | null) {
  if (!iso) return "—";
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function interpolarDatas(
  inicio: Date,
  fim: Date,
  indice: number,
  total: number
): { entrada: Date; saida: Date } {
  if (total <= 0) return { entrada: inicio, saida: fim };
  const msTotal = fim.getTime() - inicio.getTime();
  const entrada = new Date(inicio.getTime() + (msTotal * indice) / total);
  const saida = new Date(inicio.getTime() + (msTotal * (indice + 1)) / total);
  return { entrada, saida };
}

export function montarTimelineEtapasOs(opts: {
  etapas: EtapaOsLinha[];
  indiceAtual: number;
  dataEntradaLab: Date;
  dataEntradaEtapaAtual: Date;
}): EtapaTimelineOs[] {
  const { etapas, indiceAtual, dataEntradaLab, dataEntradaEtapaAtual } = opts;
  const agora = new Date();

  return etapas.map((etapa, i) => {
    let entrada: Date | null = null;
    let saida: Date | null = null;
    let estimado = false;
    let situacao: SituacaoEtapaTimeline = "aguardando";

    if (i < indiceAtual) {
      situacao = "concluida";
      if (indiceAtual > 0) {
        const interp = interpolarDatas(dataEntradaLab, dataEntradaEtapaAtual, i, indiceAtual);
        entrada = interp.entrada;
        saida = interp.saida;
        estimado = true;
      } else {
        entrada = dataEntradaLab;
        saida = dataEntradaEtapaAtual;
      }
    } else if (i === indiceAtual) {
      situacao = "atual";
      entrada = dataEntradaEtapaAtual;
      saida = null;
    }

    const diasNaEtapa =
      entrada && situacao !== "aguardando"
        ? Math.max(0, differenceInCalendarDays(agora, entrada))
        : null;

    const minPrevisto = tempoMinutosEtapa(etapa.tempo);
    const horasNaEtapa =
      entrada && saida
        ? Math.round((saida.getTime() - entrada.getTime()) / 3600000)
        : entrada
          ? Math.round((agora.getTime() - entrada.getTime()) / 3600000)
          : null;

    return {
      indice: etapa.indice,
      nome: etapa.nome,
      situacao,
      responsavel: etapa.responsavel?.trim() || "—",
      entradaIso: entrada?.toISOString() ?? null,
      entradaBr: formatarDataHoraBr(entrada?.toISOString() ?? null),
      saidaIso: saida?.toISOString() ?? null,
      saidaBr: formatarDataHoraBr(saida?.toISOString() ?? null),
      diasNaEtapa,
      horasNaEtapa,
      tempoPrevisto: etapa.tempo?.trim() || (minPrevisto ? `${minPrevisto} min` : "—"),
      observacao: etapa.observacao?.trim() || "",
      estimado,
    };
  });
}

export function gerarDetalheMockTempoProducao(linha: LinhaTempoProducao): DetalheTempoProducaoOs {
  const etapasMock: EtapaOsLinha[] = [
    { indice: 0, nome: "Entrada", responsavel: "Recepção", prazo: "", observacao: "OS recebida", tempo: "30 min" },
    { indice: 1, nome: "Modelo Individual", responsavel: "Bruno S.", prazo: "", observacao: "", tempo: "2 h" },
    { indice: 2, nome: linha.etapaAtual, responsavel: linha.colaborador, prazo: "", observacao: "Em andamento", tempo: "4 h" },
    { indice: 3, nome: "Acabamento", responsavel: "Diego F.", prazo: "", observacao: "", tempo: "1 h" },
    { indice: 4, nome: "Entrega", responsavel: "Logística", prazo: "", observacao: "", tempo: "30 min" },
  ];

  const indiceAtual = etapasMock.findIndex((e) => e.nome === linha.etapaAtual);
  const idx = indiceAtual >= 0 ? indiceAtual : 2;
  const entradaLab = parseISO(linha.dataEntradaLab);
  const entradaEtapa = parseISO(linha.dataEntradaEtapa);

  const timeline = montarTimelineEtapasOs({
    etapas: etapasMock,
    indiceAtual: idx,
    dataEntradaLab: entradaLab,
    dataEntradaEtapaAtual: entradaEtapa,
  }).map((t, i) => ({
    ...t,
    estimado: i < idx && i > 0,
    entradaBr: i <= idx ? t.entradaBr : "—",
    saidaBr: i < idx ? t.saidaBr : "—",
  }));

  return {
    resumo: linha,
    timeline,
    observacoes: "Demonstração — caso clínico de prótese com atenção ao prazo do dentista.",
    observacoesInternas: "Dados fictícios para visualização do relatório.",
    anexos: [],
    fonte: "mock",
  };
}

export function trabalhoParaDetalheTempoProducao(
  principal: TrabalhoDetalheInput,
  grupo: TrabalhoDetalheInput[],
  etapas: EtapaOsLinha[],
  concluidas: number[],
  linhaResumo: LinhaTempoProducao
): DetalheTempoProducaoOs {
  const instrucoesGrupo = grupo.map((t) => t.instrucoes || "").join("\n");
  const indiceAtual = indiceEtapaAtualDeConcluidas(concluidas, etapas.length);
  const { textoLivre } = parseComplementosInstrucoesGrupo(grupo.map((t) => t.instrucoes || ""));

  const timeline = montarTimelineEtapasOs({
    etapas,
    indiceAtual,
    dataEntradaLab: principal.dataEntrada,
    dataEntradaEtapaAtual: principal.updatedAt,
  });

  return {
    resumo: linhaResumo,
    timeline,
    observacoes: principal.observacoes?.trim() || "",
    observacoesInternas: textoLivre,
    anexos: anexosFromInstrucoes(instrucoesGrupo),
    fonte: "banco",
  };
}

export function criarLinhaResumoDeTrabalho(
  principal: TrabalhoDetalheInput,
  etapaAtual: EtapaOsLinha | undefined,
  prioridade: PrioridadeTempoProducao,
  prazoDate: Date | null
): LinhaTempoProducao {
  const metricas = calcularMetricasTempoProducao({
    dataEntradaLab: principal.dataEntrada,
    dataEntradaEtapa: principal.updatedAt,
    prazo: prazoDate,
  });

  return {
    id: principal.id,
    numeroOs: principal.numeroOs,
    paciente: principal.paciente.nome,
    dentista: principal.cliente.nome,
    tipoServico: principal.tipoProtese,
    etapaAtual: etapaAtual?.nome ?? "Sem etapa definida",
    colaborador: etapaAtual?.responsavel?.trim() || "—",
    dataEntradaLab: principal.dataEntrada.toISOString(),
    dataEntradaLabBr: formatarDataBr(principal.dataEntrada.toISOString()),
    dataEntradaEtapa: principal.updatedAt.toISOString(),
    dataEntradaEtapaBr: formatarDataBr(principal.updatedAt.toISOString()),
    prazoCombinado: prazoDate?.toISOString() ?? "",
    prazoCombinadoBr: prazoDate ? formatarDataBr(prazoDate.toISOString()) : "—",
    diasNoLaboratorio: metricas.diasNoLaboratorio,
    diasNaEtapaAtual: metricas.diasNaEtapaAtual,
    diasAtraso: metricas.diasAtraso,
    diasParaVencer: metricas.diasParaVencer,
    status: metricas.status as StatusTempoProducao,
    prioridade,
    ultimaMovimentacao: principal.updatedAt.toISOString(),
    ultimaMovimentacaoBr: format(principal.updatedAt, "dd/MM/yyyy HH:mm", { locale: ptBR }),
    responsavelPeloAtraso: "",
    paradoMuitoTempo: false,
  };
}
