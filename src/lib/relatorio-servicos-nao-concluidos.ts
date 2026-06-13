import { dateToBrShort, parseBrDate } from "@/lib/datas-br";
import {
  isTrabalhoAtrasado,
  localDate,
  prazoTrabalho,
} from "@/lib/controle-producao-prazos";
import {
  MESES_FINANCEIRO_GERAL,
  montarLinhasDetalhe,
  type TrabalhoFinanceiroGeralInput,
} from "@/lib/relatorio-financeiro-geral";
import { normalizarChaveStatusOs } from "@/lib/status-os";

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

function diasAtrasoTrabalho(
  trabalho: TrabalhoFinanceiroGeralInput,
  referencia = localDate(new Date())
) {
  if (!servicoNaoConcluidoRelatorio(trabalho.status)) return 0;
  if (!isTrabalhoAtrasado(trabalho, "lab", referencia)) return 0;
  const prazo = prazoTrabalho(trabalho, "lab");
  if (!prazo) return 0;
  const diff = Math.floor(
    (referencia.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, diff);
}

export function calcularRelatorioServicosNaoConcluidos(
  trabalhos: TrabalhoFinanceiroGeralInput[],
  filtros: FiltrosServicosNaoConcluidos,
  mapaEtapas: Record<string, number[]> = {}
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
  const referencia = localDate(new Date());

  const quantidade = naoConcluidas.length;
  const valorTotalPreso = naoConcluidas.reduce((s, l) => s + l.valor, 0);
  const tempoMedioParado =
    quantidade > 0
      ? Math.round(
          naoConcluidas.reduce((s, l) => s + l.diasProducao, 0) / quantidade
        )
      : 0;

  const vencidos: ServicoVencido[] = naoConcluidas
    .map((l) => {
      const trabalho = mapaTrabalho.get(l.id);
      if (!trabalho) return null;
      const diasAtraso = diasAtrasoTrabalho(trabalho, referencia);
      if (diasAtraso <= 0) return null;
      return {
        numeroOs: l.numeroOs,
        cliente: l.cliente,
        etapaAtual: l.etapaAtual,
        diasAtraso,
        valor: l.valor,
      };
    })
    .filter((v): v is ServicoVencido => v !== null)
    .sort((a, b) => b.diasAtraso - a.diasAtraso);

  const percentualProducao =
    totalProducao > 0 ? (quantidade / totalProducao) * 100 : 0;

  const mesesPeriodo = mesesNoPeriodo(inicio, fim);
  const valorPorMes = mesesPeriodo.map(({ ano, mesIdx, label }) => ({
    mes: MESES_FINANCEIRO_GERAL[mesIdx],
    ano,
    label,
    valor: naoConcluidas
      .filter((l) => l.anoEntrada === ano && l.mesEntrada === mesIdx)
      .reduce((s, l) => s + l.valor, 0),
  }));

  const contagemEtapa = new Map<EtapaGrupoRelatorio, { qtd: number; valor: number }>();
  for (const etapa of ETAPAS_RELATORIO) {
    contagemEtapa.set(etapa, { qtd: 0, valor: 0 });
  }
  for (const l of naoConcluidas) {
    const grupo = agruparEtapaRelatorio(l.etapaAtual);
    const atual = contagemEtapa.get(grupo) ?? { qtd: 0, valor: 0 };
    contagemEtapa.set(grupo, {
      qtd: atual.qtd + 1,
      valor: atual.valor + l.valor,
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

  const aggCliente = new Map<string, ClienteNaoConcluido>();
  for (const l of naoConcluidas) {
    const existente = aggCliente.get(l.cliente);
    if (!existente) {
      aggCliente.set(l.cliente, {
        cliente: l.cliente,
        quantidade: 1,
        valorTotal: l.valor,
        tempoMedioParado: l.diasProducao,
        maiorTempoParado: l.diasProducao,
      });
      continue;
    }
    const qtd = existente.quantidade + 1;
    aggCliente.set(l.cliente, {
      cliente: l.cliente,
      quantidade: qtd,
      valorTotal: existente.valorTotal + l.valor,
      tempoMedioParado: Math.round(
        (existente.tempoMedioParado * existente.quantidade + l.diasProducao) / qtd
      ),
      maiorTempoParado: Math.max(existente.maiorTempoParado, l.diasProducao),
    });
  }

  const porCliente = [...aggCliente.values()]
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
