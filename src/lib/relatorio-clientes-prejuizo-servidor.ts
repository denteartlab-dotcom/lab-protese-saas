import { dateToBrShort, parseBrDate } from "@/lib/datas-br";
import {
  analisarRepeticoesPorOs,
  duracaoMsHistorico,
  normalizarEtapaHistorico,
  statusCriticidadePorRepeticoes,
  type HistoricoEtapaRow,
} from "@/lib/historico-etapas";
import {
  OPCOES_PERIODO_CLIENTES_PREJUIZO,
  type AlertaGargalo,
  type ClienteDevolucao,
  type ClienteRetornoServico,
  type ClienteRepeteEtapas,
  type ClienteTempoAprovacao,
  type GraficoBarraRepeticao,
  type MotivoFrequente,
  type PeriodoClientesPrejuizo,
  type PrejuizoCliente,
  type RelatorioClientesPrejuizoPayload,
  type RepeticoesResumo,
  type ResumoClientesPrejuizo,
  type StatusCriticidadeCliente,
} from "@/lib/relatorio-clientes-prejuizo";

export type TrabalhoPrejuizoInput = {
  id: string;
  numeroOs: number;
  clienteId: string;
  clienteNome: string;
  valor: number;
  instrucoes: string | null;
};

function inicioPeriodo(
  periodo: PeriodoClientesPrejuizo,
  dataInicio?: string,
  dataFim?: string
): { inicio: Date; fim: Date; label: string } {
  const agora = new Date();
  const fim = new Date(agora);
  fim.setHours(23, 59, 59, 999);

  if (periodo === "personalizado" && dataInicio && dataFim) {
    const ini = parseBrDate(dataInicio);
    const end = parseBrDate(dataFim);
    if (ini && end) {
      end.setHours(23, 59, 59, 999);
      return {
        inicio: ini,
        fim: end,
        label: `${dataInicio} — ${dataFim}`,
      };
    }
  }

  if (periodo === "90dias") {
    const inicio = new Date(agora);
    inicio.setDate(inicio.getDate() - 90);
    inicio.setHours(0, 0, 0, 0);
    return { inicio, fim, label: "Últimos 90 dias" };
  }

  if (periodo === "mes_atual") {
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    inicio.setHours(0, 0, 0, 0);
    return { inicio, fim, label: "Este mês" };
  }

  const inicio = new Date(agora);
  inicio.setDate(inicio.getDate() - 30);
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim, label: "Últimos 30 dias" };
}

function contarEtapasInstrucoes(instrucoes: string | null) {
  if (!instrucoes) return 1;
  const linhas = instrucoes
    .split("\n")
    .filter((l) => /^Etapa\s+/i.test(l.trim()));
  return Math.max(1, linhas.length);
}

function estimarCustoRepeticao(valor: number, numEtapas: number, repeticoes: number) {
  if (repeticoes <= 0 || valor <= 0) return 0;
  const custoEtapa = valor / Math.max(1, numEtapas);
  return custoEtapa * repeticoes;
}

export function calcularRelatorioClientesPrejuizo(
  historico: HistoricoEtapaRow[],
  trabalhos: TrabalhoPrejuizoInput[],
  opts?: {
    periodo?: PeriodoClientesPrejuizo;
    dataInicio?: string;
    dataFim?: string;
  }
): RelatorioClientesPrejuizoPayload {
  const periodo = opts?.periodo ?? "30dias";
  const { inicio, fim, label } = inicioPeriodo(periodo, opts?.dataInicio, opts?.dataFim);

  const historicoPeriodo = historico.filter(
    (h) => h.dataEntrada >= inicio && h.dataEntrada <= fim
  );

  const mapaTrabalhos = new Map(trabalhos.map((t) => [t.id, t]));
  const mapaClientes = new Map<string, string>();
  for (const t of trabalhos) {
    mapaClientes.set(t.clienteId, t.clienteNome);
  }

  const analises = analisarRepeticoesPorOs(historicoPeriodo);

  const totalRepeticoes = analises.reduce((s, a) => s + a.totalRepeticoes, 0);
  const servicosComRetrabalho = analises.filter((a) => a.temRepeticao).length;

  const contagemEtapaLab = new Map<string, number>();
  for (const a of analises) {
    for (const e of a.etapasRepetidas) {
      contagemEtapaLab.set(
        e.etapa,
        (contagemEtapaLab.get(e.etapa) ?? 0) + e.repeticoes
      );
    }
  }

  const etapaMaisRepetida =
    [...contagemEtapaLab.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  type AggCliente = {
    clienteId: string;
    clienteNome: string;
    totalRepeticoes: number;
    servicosComRepeticao: Set<string>;
    etapas: Map<string, number>;
    devolucoes: number;
    garantias: number;
    tempoParadoMs: number;
    prejuizo: number;
    motivos: Map<string, number>;
  };

  const aggPorCliente = new Map<string, AggCliente>();

  function obterAgg(clienteId: string): AggCliente {
    const existente = aggPorCliente.get(clienteId);
    if (existente) return existente;
    const novo: AggCliente = {
      clienteId,
      clienteNome: mapaClientes.get(clienteId) ?? "—",
      totalRepeticoes: 0,
      servicosComRepeticao: new Set(),
      etapas: new Map(),
      devolucoes: 0,
      garantias: 0,
      tempoParadoMs: 0,
      prejuizo: 0,
      motivos: new Map(),
    };
    aggPorCliente.set(clienteId, novo);
    return novo;
  }

  for (const a of analises) {
    const agg = obterAgg(a.clienteId);
    agg.totalRepeticoes += a.totalRepeticoes;
    if (a.temRepeticao) agg.servicosComRepeticao.add(a.trabalhoId);

    const trabalho = mapaTrabalhos.get(a.trabalhoId);
    const numEtapas = contarEtapasInstrucoes(trabalho?.instrucoes ?? null);
    const valor = trabalho?.valor ?? 0;
    agg.prejuizo += estimarCustoRepeticao(valor, numEtapas, a.totalRepeticoes);

    for (const e of a.etapasRepetidas) {
      agg.etapas.set(e.etapa, (agg.etapas.get(e.etapa) ?? 0) + e.repeticoes);
    }
  }

  for (const h of historicoPeriodo) {
    const agg = obterAgg(h.clienteId);
    agg.tempoParadoMs += duracaoMsHistorico(h.dataEntrada, h.dataSaida);

    if (h.motivoRetorno) {
      const motivo = h.motivoRetorno.trim();
      agg.motivos.set(motivo, (agg.motivos.get(motivo) ?? 0) + 1);
      const lower = motivo.toLowerCase();
      if (lower.includes("garantia")) agg.garantias += 1;
      if (lower.includes("devolu")) agg.devolucoes += 1;
    }
  }

  const clientesOrdenados = [...aggPorCliente.values()].sort(
    (a, b) => b.totalRepeticoes - a.totalRepeticoes
  );

  const clienteMaisCritico = clientesOrdenados[0]?.clienteNome ?? "—";

  const repeticoesResumo: RepeticoesResumo = {
    totalRepeticoes,
    servicosComRetrabalho,
    etapaMaisRepetida,
    clienteMaisCritico,
  };

  const resumo: ResumoClientesPrejuizo = {
    retrabalhos: totalRepeticoes,
    garantias: [...aggPorCliente.values()].reduce((s, c) => s + c.garantias, 0),
    clientesCriticos: clientesOrdenados.filter(
      (c) => statusCriticidadePorRepeticoes(c.totalRepeticoes) === "alto"
    ).length,
    prejuizoEstimado: [...aggPorCliente.values()].reduce((s, c) => s + c.prejuizo, 0),
  };

  const clientesRetorno: ClienteRetornoServico[] = clientesOrdenados
    .filter((c) => c.totalRepeticoes > 0)
    .slice(0, 10)
    .map((c) => ({
      cliente: c.clienteNome,
      retrabalhos: c.totalRepeticoes,
      garantias: c.garantias,
      status: statusCriticidadePorRepeticoes(c.totalRepeticoes) as StatusCriticidadeCliente,
    }));

  const clientesRepetemEtapas: ClienteRepeteEtapas[] = clientesOrdenados
    .filter((c) => c.totalRepeticoes > 0)
    .slice(0, 10)
    .map((c) => {
      const etapaTop = [...c.etapas.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        cliente: c.clienteNome,
        servicosComRepeticao: c.servicosComRepeticao.size,
        totalRepeticoes: c.totalRepeticoes,
        etapaMaisRepetida: etapaTop?.[0] ?? "—",
        status: statusCriticidadePorRepeticoes(c.totalRepeticoes),
      };
    });

  const clientesAprovacao: ClienteTempoAprovacao[] = clientesOrdenados
    .filter((c) => c.tempoParadoMs > 0)
    .slice(0, 10)
    .map((c) => ({
      cliente: c.clienteNome,
      tempoMedioDias: Math.round(c.tempoParadoMs / (1000 * 60 * 60 * 24) / Math.max(1, c.servicosComRepeticao.size || 1)),
    }))
    .sort((a, b) => b.tempoMedioDias - a.tempoMedioDias);

  const clientesDevolucao: ClienteDevolucao[] = clientesOrdenados
    .filter((c) => c.devolucoes > 0 || c.totalRepeticoes > 0)
    .slice(0, 10)
    .map((c) => ({
      cliente: c.clienteNome,
      devolucoes: c.devolucoes > 0 ? c.devolucoes : c.servicosComRepeticao.size,
    }))
    .sort((a, b) => b.devolucoes - a.devolucoes);

  const motivosFrequentes: MotivoFrequente[] = Array.from(
    [...aggPorCliente.values()]
      .flatMap((c) => [...c.motivos.entries()])
      .reduce((acc, [motivo, qtd]) => {
        acc.set(motivo, (acc.get(motivo) ?? 0) + qtd);
        return acc;
      }, new Map<string, number>())
      .entries()
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([motivo, quantidade]) => ({ motivo, quantidade }));

  const prejuizoPorCliente: PrejuizoCliente[] = clientesOrdenados
    .filter((c) => c.prejuizo > 0)
    .slice(0, 10)
    .map((c) => ({ cliente: c.clienteNome, valor: Math.round(c.prejuizo * 100) / 100 }));

  const graficoTop10Clientes: GraficoBarraRepeticao[] = clientesOrdenados
    .filter((c) => c.totalRepeticoes > 0)
    .slice(0, 10)
    .map((c) => ({
      nome: c.clienteNome,
      valor: c.totalRepeticoes,
    }));

  const graficoEtapasRepetidas: GraficoBarraRepeticao[] = [...contagemEtapaLab.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, valor]) => ({
      nome: normalizarEtapaHistorico(nome),
      valor,
    }));

  const alertasGargalos: AlertaGargalo[] = [];

  const topCliente = clientesOrdenados[0];
  if (topCliente && topCliente.totalRepeticoes > 0) {
    const itens: string[] = [];
    if (topCliente.totalRepeticoes >= 4) itens.push("Maior número de retrabalhos");
    const tempoDias = Math.round(topCliente.tempoParadoMs / (1000 * 60 * 60 * 24));
    if (tempoDias >= 7) itens.push("Maior tempo de aprovação");
    if (topCliente.prejuizo >= 100) itens.push("Maior custo para o laboratório");
    if (itens.length) {
      alertasGargalos.push({
        cliente: topCliente.clienteNome,
        nivel: statusCriticidadePorRepeticoes(topCliente.totalRepeticoes) === "baixo" ? "medio" : "alto",
        itens,
      });
    }
  }

  const segundo = clientesOrdenados[1];
  if (segundo && (segundo.devolucoes > 0 || segundo.totalRepeticoes >= 4)) {
    const itens: string[] = [];
    if (segundo.devolucoes > 0) itens.push("Muitas devoluções");
    if (segundo.totalRepeticoes >= 4) itens.push("Aumento de ocorrências no período");
    if (itens.length) {
      alertasGargalos.push({
        cliente: segundo.clienteNome,
        nivel: "medio",
        itens,
      });
    }
  }

  const agora = new Date();
  return {
    resumo,
    repeticoesResumo,
    clientesRetorno,
    clientesRepetemEtapas,
    clientesAprovacao,
    clientesDevolucao,
    motivosFrequentes,
    prejuizoPorCliente,
    alertasGargalos,
    graficoTop10Clientes,
    graficoEtapasRepetidas,
    periodoLabel: label,
    geradoEm: agora.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function labelPeriodoClientesPrejuizo(
  periodo: PeriodoClientesPrejuizo,
  dataInicio?: string,
  dataFim?: string
) {
  const op = OPCOES_PERIODO_CLIENTES_PREJUIZO.find((o) => o.value === periodo);
  if (periodo === "personalizado" && dataInicio && dataFim) {
    return `${dataInicio} — ${dataFim}`;
  }
  return op?.label ?? "Período";
}
