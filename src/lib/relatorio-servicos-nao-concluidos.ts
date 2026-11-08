import { prazoTrabalho } from "@/lib/controle-producao-prazos";
import { dateToBrShort, parseBrDate } from "@/lib/datas-br";
import {
  MESES_FINANCEIRO_GERAL,
  montarLinhasDetalhe,
  type LinhaDetalheFinanceiroGeral,
  type TrabalhoFinanceiroGeralInput,
} from "@/lib/relatorio-financeiro-geral";
import { normalizarChaveStatusOs } from "@/lib/status-os";
import {
  chaveInicioProducaoOs,
  diasAtrasoContadosNaProducao,
  diasNaSituacaoProducao,
  type OrigemContagemProducao,
} from "@/lib/tempo-producao-inicio";

export const ETAPAS_RELATORIO = [
  "Montagem",
  "Acrilização",
  "Plano de Cera",
  "Acabamento",
  "Ceroplastia",
  "Outras",
] as const;

export type EtapaGrupoRelatorio = (typeof ETAPAS_RELATORIO)[number];

export type FiltrosServicosNaoConcluidos = {
  dataInicio: string;
  dataFim: string;
};

export type ClienteNaoConcluido = {
  cliente: string;
  quantidade: number;
  valorTotal: number;
  tempoMedioParado: number;
  maiorTempoParado: number;
};

export type ServicoVencido = {
  numeroOs: number;
  cliente: string;
  etapaAtual: string;
  diasAtraso: number;
  valor: number;
};

export type RelatorioServicosNaoConcluidosPayload = {
  resumo: {
    quantidade: number;
    valorTotalPreso: number;
    tempoMedioParado: number;
    servicosVencidos: number;
    percentualProducao: number;
  };
  valorPorMes: { mes: string; ano: number; label: string; valor: number }[];
  quantidadePorEtapa: {
    etapa: EtapaGrupoRelatorio;
    quantidade: number;
    percentual: number;
  }[];
  valorPorEtapa: { etapa: EtapaGrupoRelatorio; valor: number }[];
  porCliente: ClienteNaoConcluido[];
  vencidos: ServicoVencido[];
  periodoLabel: string;
  geradoEm: string;
};

export function agruparEtapaRelatorio(nomeEtapa: string): EtapaGrupoRelatorio {
  const n = nomeEtapa.trim().toLowerCase();
  if (n.includes("montagem")) return "Montagem";
  if (n.includes("acriliz")) return "Acrilização";
  if (n.includes("plano") && n.includes("cera")) return "Plano de Cera";
  if (n.includes("acabamento")) return "Acabamento";
  if (n.includes("ceroplast")) return "Ceroplastia";
  return "Outras";
}

export function servicoNaoConcluidoRelatorio(status?: string | null) {
  const key = normalizarChaveStatusOs(status);
  return key !== "finalizado" && key !== "entregue" && key !== "cancelado";
}

export function formatarMoedaServicosNaoConcluidos(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarPercentualServicosNaoConcluidos(valor: number) {
  return `${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function periodoTextoServicosNaoConcluidos(filtros: FiltrosServicosNaoConcluidos) {
  if (filtros.dataInicio && filtros.dataFim) {
    return `${filtros.dataInicio} — ${filtros.dataFim}`;
  }
  return "Período não informado";
}

export function normalizarPeriodoFiltrosServicosNaoConcluidos(
  filtros: FiltrosServicosNaoConcluidos
): FiltrosServicosNaoConcluidos {
  const inicio = parseBrDate(filtros.dataInicio);
  const fim = parseBrDate(filtros.dataFim);
  if (!inicio || !fim) return filtros;
  if (inicio <= fim) return filtros;
  return {
    dataInicio: dateToBrShort(fim),
    dataFim: dateToBrShort(inicio),
  };
}

export function periodoFiltroServicosNaoConcluidosValido(
  filtros: FiltrosServicosNaoConcluidos
) {
  return (
    filtros.dataInicio.length === 10 &&
    filtros.dataFim.length === 10 &&
    parseBrDate(filtros.dataInicio) !== null &&
    parseBrDate(filtros.dataFim) !== null
  );
}

function mesesNoPeriodo(inicio: Date, fim: Date) {
  const meses: { ano: number; mesIdx: number; label: string }[] = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const limite = new Date(fim.getFullYear(), fim.getMonth(), 1);
  while (cursor <= limite) {
    meses.push({
      ano: cursor.getFullYear(),
      mesIdx: cursor.getMonth(),
      label: `${MESES_FINANCEIRO_GERAL[cursor.getMonth()]}/${cursor.getFullYear()}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return meses;
}

function prazoContagemServico(trabalho: TrabalhoFinanceiroGeralInput) {
  if (trabalho.dataPrevista) {
    const prevista = new Date(trabalho.dataPrevista);
    if (!Number.isNaN(prevista.getTime())) return prevista;
  }
  return prazoTrabalho(trabalho, "lab");
}

function origemContagemProducao(
  linha: LinhaDetalheFinanceiroGeral,
  trabalho: TrabalhoFinanceiroGeralInput,
  mapaInicioProducao: Record<string, string>
): OrigemContagemProducao {
  return {
    status: linha.status,
    inicioRegistrado: mapaInicioProducao[chaveInicioProducaoOs(trabalho)] ?? null,
    instrucoes: trabalho.instrucoes,
    dataEntrada: trabalho.dataEntrada,
  };
}

export function calcularRelatorioServicosNaoConcluidos(
  trabalhos: TrabalhoFinanceiroGeralInput[],
  filtros: FiltrosServicosNaoConcluidos,
  mapaEtapas: Record<string, number[]> = {},
  mapaInicioProducao: Record<string, string> = {}
): RelatorioServicosNaoConcluidosPayload {
  const inicio =
    parseBrDate(filtros.dataInicio) ?? new Date(new Date().getFullYear(), 0, 1);
  const fim = parseBrDate(filtros.dataFim) ?? new Date();
  fim.setHours(23, 59, 59, 999);

  const mapaTrabalho = new Map(trabalhos.map((t) => [t.id, t]));
  const todasLinhas = montarLinhasDetalhe(trabalhos, mapaEtapas);

  const noPeriodo = todasLinhas.filter((l) => {
    const entrada = parseBrDate(l.dataEntrada);
    return entrada && entrada >= inicio && entrada <= fim;
  });

  const naoConcluidas = noPeriodo.filter((l) => !l.concluido);
  const totalProducao = noPeriodo.length;
  const referencia = new Date();

  const comDias = naoConcluidas.map((linha) => {
    const trabalho = mapaTrabalho.get(linha.id);
    if (!trabalho) return { linha, parado: 0, atraso: 0 };
    const origem = origemContagemProducao(linha, trabalho, mapaInicioProducao);
    return {
      linha,
      parado: diasNaSituacaoProducao(origem, referencia),
      atraso: diasAtrasoContadosNaProducao(
        { ...origem, prazo: prazoContagemServico(trabalho) },
        referencia
      ),
    };
  });

  const quantidade = comDias.length;
  const valorTotalPreso = comDias.reduce((s, item) => s + item.linha.valor, 0);
  const tempoMedioParado =
    quantidade > 0
      ? Math.round(comDias.reduce((s, item) => s + item.parado, 0) / quantidade)
      : 0;

  const vencidos: ServicoVencido[] = comDias
    .filter((item) => item.atraso > 0)
    .map((item) => ({
      numeroOs: item.linha.numeroOs,
      cliente: item.linha.cliente,
      etapaAtual: item.linha.etapaAtual,
      diasAtraso: item.atraso,
      valor: item.linha.valor,
    }))
    .sort((a, b) => b.diasAtraso - a.diasAtraso);

  const percentualProducao =
    totalProducao > 0 ? (quantidade / totalProducao) * 100 : 0;

  const mesesPeriodo = mesesNoPeriodo(inicio, fim);
  const valorPorMes = mesesPeriodo.map(({ ano, mesIdx, label }) => ({
    mes: MESES_FINANCEIRO_GERAL[mesIdx],
    ano,
    label,
    valor: comDias
      .filter(
        (item) => item.linha.anoEntrada === ano && item.linha.mesEntrada === mesIdx
      )
      .reduce((s, item) => s + item.linha.valor, 0),
  }));

  const contagemEtapa = new Map<EtapaGrupoRelatorio, { qtd: number; valor: number }>();
  for (const etapa of ETAPAS_RELATORIO) {
    contagemEtapa.set(etapa, { qtd: 0, valor: 0 });
  }
  for (const item of comDias) {
    const grupo = agruparEtapaRelatorio(item.linha.etapaAtual);
    const atual = contagemEtapa.get(grupo) ?? { qtd: 0, valor: 0 };
    contagemEtapa.set(grupo, {
      qtd: atual.qtd + 1,
      valor: atual.valor + item.linha.valor,
    });
  }

  const quantidadePorEtapa = ETAPAS_RELATORIO.map((etapa) => {
    const dados = contagemEtapa.get(etapa) ?? { qtd: 0, valor: 0 };
    return {
      etapa,
      quantidade: dados.qtd,
      percentual: quantidade > 0 ? (dados.qtd / quantidade) * 100 : 0,
    };
  }).filter((e) => e.quantidade > 0);

  const valorPorEtapa = ETAPAS_RELATORIO.map((etapa) => ({
    etapa,
    valor: contagemEtapa.get(etapa)?.valor ?? 0,
  })).filter((e) => e.valor > 0);

  const aggCliente = new Map<string, ClienteNaoConcluido & { somaDias: number }>();
  for (const item of comDias) {
    const cliente = item.linha.cliente;
    const existente = aggCliente.get(cliente);
    if (!existente) {
      aggCliente.set(cliente, {
        cliente,
        quantidade: 1,
        valorTotal: item.linha.valor,
        somaDias: item.parado,
        tempoMedioParado: 0,
        maiorTempoParado: item.parado,
      });
      continue;
    }
    existente.quantidade += 1;
    existente.valorTotal += item.linha.valor;
    existente.somaDias += item.parado;
    existente.maiorTempoParado = Math.max(existente.maiorTempoParado, item.parado);
  }

  const porCliente = [...aggCliente.values()]
    .map((cliente) => ({
      cliente: cliente.cliente,
      quantidade: cliente.quantidade,
      valorTotal: cliente.valorTotal,
      tempoMedioParado:
        cliente.quantidade > 0 ? Math.round(cliente.somaDias / cliente.quantidade) : 0,
      maiorTempoParado: cliente.maiorTempoParado,
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal)
    .slice(0, 10);

  const agora = new Date();
  return {
    resumo: {
      quantidade,
      valorTotalPreso,
      tempoMedioParado,
      servicosVencidos: vencidos.length,
      percentualProducao,
    },
    valorPorMes,
    quantidadePorEtapa,
    valorPorEtapa,
    porCliente,
    vencidos: vencidos.slice(0, 10),
    periodoLabel: periodoTextoServicosNaoConcluidos(filtros),
    geradoEm: agora.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function filtrosPadraoServicosNaoConcluidos(): FiltrosServicosNaoConcluidos {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return {
    dataInicio: dateToBrShort(inicio),
    dataFim: dateToBrShort(hoje),
  };
}
