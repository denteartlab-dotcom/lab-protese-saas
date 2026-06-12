import { dateToBrShort, parseBrDate } from "@/lib/datas-br";
import {
  nomeEtapaSemSetor,
  parseComplementosInstrucoesGrupo,
} from "@/lib/etapas-os";
import { itensDaOsModulo } from "@/lib/modulo-producao-os";
import { indiceEtapaAtualDeConcluidas } from "@/lib/modulo-producao-etapas";
import { normalizarChaveStatusOs, labelStatusOs } from "@/lib/status-os";

export const MESES_FINANCEIRO_GERAL = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export const CATEGORIAS_TIPO_SERVICO = [
  "Prótese Total",
  "PPR",
  "Protocolo",
  "Coroa",
  "Barra Protocolo",
  "Placa Bruxismo",
  "Outros",
] as const;

export type CategoriaTipoServico = (typeof CATEGORIAS_TIPO_SERVICO)[number];

export type FiltrosRelatorioFinanceiroGeral = {
  dataInicio: string;
  dataFim: string;
  cliente: string;
  tipoServico: string;
  status: string;
};

export type TrabalhoFinanceiroGeralInput = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  valor: number;
  status: string;
  segmentoFaturamento: string;
  dataEntrada: string;
  dataPrevista: string | null;
  dataEntrega: string | null;
  instrucoes: string | null;
  clienteNome: string;
  pacienteNome: string;
};

export type LinhaDetalheFinanceiroGeral = {
  id: string;
  numeroOs: number;
  cliente: string;
  servico: string;
  valor: number;
  dataEntrada: string;
  prazo: string;
  diasProducao: number;
  status: string;
  statusLabel: string;
  etapaAtual: string;
  responsavel: string;
  concluido: boolean;
  mesEntrada: number;
  anoEntrada: number;
  categoriaServico: CategoriaTipoServico;
};

export type MesValorFinanceiroGeral = {
  mes: string;
  mesIdx: number;
  ano: number;
  naoConcluido: number;
  concluido: number;
  total: number;
  quantidade: number;
  ticketMedio: number;
};

export type RelatorioFinanceiroGeralPayload = {
  resumo: {
    valorBrutoTotal: number;
    quantidadeTotal: number;
    ticketMedio: number;
    valorMedioMensal: number;
    naoConcluidosQtd: number;
    naoConcluidosValor: number;
    concluidosQtd: number;
    concluidosValor: number;
  };
  evolucaoMensal: MesValorFinanceiroGeral[];
  distribuicaoTipo: {
    tipo: CategoriaTipoServico;
    quantidade: number;
    valor: number;
    percentual: number;
  }[];
  statusResumo: {
    naoConcluidos: { quantidade: number; valor: number; percentual: number };
    concluidos: { quantidade: number; valor: number; percentual: number };
  };
  tabelaPorMes: MesValorFinanceiroGeral[];
  tabelaPorTipo: {
    servico: CategoriaTipoServico;
    quantidade: number;
    valor: number;
    percentual: number;
  }[];
  detalhes: LinhaDetalheFinanceiroGeral[];
  clientesOpcoes: string[];
  tiposServicoOpcoes: string[];
};

export function servicoConcluidoFinanceiro(status?: string | null) {
  const key = normalizarChaveStatusOs(status);
  return key === "finalizado" || key === "entregue";
}

export function categorizarTipoServico(tipoProtese: string): CategoriaTipoServico {
  const t = tipoProtese.trim().toLowerCase();
  if (t.includes("prótese total") || t.includes("protese total")) return "Prótese Total";
  if (t.includes("parcial remov") || t === "ppr" || t.includes(" ppr")) return "PPR";
  if (t.includes("barra") && t.includes("protocolo")) return "Barra Protocolo";
  if (t.includes("protocolo")) return "Protocolo";
  if (
    t.includes("coroa") ||
    t.includes("faceta") ||
    t.includes("laminado") ||
    t.includes("zircônia") ||
    t.includes("zirconia") ||
    t.includes("metalocer")
  ) {
    return "Coroa";
  }
  if (t.includes("bruxismo") || t.includes("placa de mordida") || t.includes("placa bruxismo")) {
    return "Placa Bruxismo";
  }
  return "Outros";
}

function parseDataEntrada(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diasEmProducao(dataEntrada: Date, dataEntrega: Date | null, concluido: boolean) {
  const fim = concluido && dataEntrega ? dataEntrega : new Date();
  const diff = Math.floor((fim.getTime() - dataEntrada.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function resolverEtapaResponsavel(
  trabalho: TrabalhoFinanceiroGeralInput,
  mapaEtapas: Record<string, number[]>
) {
  const moduloOs = {
    id: trabalho.id,
    numeroOs: trabalho.numeroOs,
    tipoProtese: trabalho.tipoProtese,
    valor: trabalho.valor,
    status: trabalho.status,
    instrucoes: trabalho.instrucoes,
    dataEntrada: trabalho.dataEntrada,
    dataPrevista: trabalho.dataPrevista,
    cliente: { nome: trabalho.clienteNome },
    paciente: { nome: trabalho.pacienteNome },
  };
  const item = itensDaOsModulo(moduloOs)[0];
  const chave = `${trabalho.id}:${item.id}`;
  const { etapas, colaboradores } = parseComplementosInstrucoesGrupo([
    trabalho.instrucoes || "",
  ]);
  const concluidas = mapaEtapas[chave] ?? [];
  const indice = indiceEtapaAtualDeConcluidas(concluidas, etapas.length);
  const etapa = etapas[indice];
  const etapaAtual = etapa ? nomeEtapaSemSetor(etapa.nome) : "Em produção";
  const responsavel =
    etapa?.responsavel?.trim() || colaboradores.find((c) => c.nome.trim())?.nome || "—";
  return { etapaAtual, responsavel };
}

function passaFiltros(
  linha: LinhaDetalheFinanceiroGeral,
  filtros: FiltrosRelatorioFinanceiroGeral
) {
  if (filtros.cliente && filtros.cliente !== "Todos" && linha.cliente !== filtros.cliente) {
    return false;
  }
  if (
    filtros.tipoServico &&
    filtros.tipoServico !== "Todos" &&
    linha.categoriaServico !== filtros.tipoServico
  ) {
    return false;
  }
  if (filtros.status && filtros.status !== "Todos") {
    const key = normalizarChaveStatusOs(linha.status);
    if (key !== filtros.status) return false;
  }
  return true;
}

function mesesNoPeriodo(inicio: Date, fim: Date) {
  const meses: { ano: number; mesIdx: number; label: string }[] = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const limite = new Date(fim.getFullYear(), fim.getMonth(), 1);
  while (cursor <= limite) {
    meses.push({
      ano: cursor.getFullYear(),
      mesIdx: cursor.getMonth(),
      label: MESES_FINANCEIRO_GERAL[cursor.getMonth()],
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return meses;
}

export function montarLinhasDetalhe(
  trabalhos: TrabalhoFinanceiroGeralInput[],
  mapaEtapas: Record<string, number[]> = {}
): LinhaDetalheFinanceiroGeral[] {
  return trabalhos
    .filter((t) => t.segmentoFaturamento === "servico")
    .filter((t) => normalizarChaveStatusOs(t.status) !== "cancelado")
    .map((t) => {
      const entrada = parseDataEntrada(t.dataEntrada);
      const entrega = t.dataEntrega ? parseDataEntrada(t.dataEntrega) : null;
      const concluido = servicoConcluidoFinanceiro(t.status);
      const { etapaAtual, responsavel } = resolverEtapaResponsavel(t, mapaEtapas);
      return {
        id: t.id,
        numeroOs: t.numeroOs,
        cliente: t.clienteNome,
        servico: t.tipoProtese,
        valor: Number(t.valor) || 0,
        dataEntrada: entrada ? dateToBrShort(entrada) : "—",
        prazo: t.dataPrevista
          ? dateToBrShort(parseDataEntrada(t.dataPrevista) ?? new Date())
          : "—",
        diasProducao: entrada ? diasEmProducao(entrada, entrega, concluido) : 0,
        status: normalizarChaveStatusOs(t.status),
        statusLabel: labelStatusOs(t.status),
        etapaAtual,
        responsavel,
        concluido,
        mesEntrada: entrada?.getMonth() ?? 0,
        anoEntrada: entrada?.getFullYear() ?? new Date().getFullYear(),
        categoriaServico: categorizarTipoServico(t.tipoProtese),
      };
    });
}

export function calcularRelatorioFinanceiroGeral(
  trabalhos: TrabalhoFinanceiroGeralInput[],
  filtros: FiltrosRelatorioFinanceiroGeral,
  mapaEtapas: Record<string, number[]> = {}
): RelatorioFinanceiroGeralPayload {
  const inicio =
    parseBrDate(filtros.dataInicio) ??
    new Date(new Date().getFullYear(), 0, 1);
  const fim =
    parseBrDate(filtros.dataFim) ?? new Date(new Date().getFullYear(), 11, 31);
  fim.setHours(23, 59, 59, 999);

  const todasLinhas = montarLinhasDetalhe(trabalhos, mapaEtapas).filter((linha) => {
    const entrada = parseBrDate(linha.dataEntrada);
    if (!entrada) return false;
    return entrada >= inicio && entrada <= fim;
  });

  const linhas = todasLinhas.filter((l) => passaFiltros(l, filtros));

  const valorBrutoTotal = linhas.reduce((s, l) => s + l.valor, 0);
  const quantidadeTotal = linhas.length;
  const ticketMedio = quantidadeTotal > 0 ? valorBrutoTotal / quantidadeTotal : 0;

  const naoConcluidos = linhas.filter((l) => !l.concluido);
  const concluidos = linhas.filter((l) => l.concluido);

  const mesesPeriodo = mesesNoPeriodo(inicio, fim);
  const valorMedioMensal =
    mesesPeriodo.length > 0 ? valorBrutoTotal / mesesPeriodo.length : 0;

  const evolucaoMensal: MesValorFinanceiroGeral[] = mesesPeriodo.map(({ ano, mesIdx, label }) => {
    const doMes = linhas.filter((l) => l.anoEntrada === ano && l.mesEntrada === mesIdx);
    const valorNao = doMes.filter((l) => !l.concluido).reduce((s, l) => s + l.valor, 0);
    const valorSim = doMes.filter((l) => l.concluido).reduce((s, l) => s + l.valor, 0);
    const total = valorNao + valorSim;
    const qtd = doMes.length;
    return {
      mes: label,
      mesIdx,
      ano,
      naoConcluido: valorNao,
      concluido: valorSim,
      total,
      quantidade: qtd,
      ticketMedio: qtd > 0 ? total / qtd : 0,
    };
  });

  const mapaTipo = new Map<CategoriaTipoServico, { quantidade: number; valor: number }>();
  for (const cat of CATEGORIAS_TIPO_SERVICO) {
    mapaTipo.set(cat, { quantidade: 0, valor: 0 });
  }
  for (const linha of linhas) {
    const atual = mapaTipo.get(linha.categoriaServico)!;
    atual.quantidade += 1;
    atual.valor += linha.valor;
    mapaTipo.set(linha.categoriaServico, atual);
  }

  const distribuicaoTipo = CATEGORIAS_TIPO_SERVICO.map((tipo) => {
    const dados = mapaTipo.get(tipo)!;
    return {
      tipo,
      quantidade: dados.quantidade,
      valor: dados.valor,
      percentual: valorBrutoTotal > 0 ? (dados.valor / valorBrutoTotal) * 100 : 0,
    };
  }).filter((d) => d.quantidade > 0 || d.valor > 0);

  const pct = (valor: number) => (valorBrutoTotal > 0 ? (valor / valorBrutoTotal) * 100 : 0);

  const clientesOpcoes = [
    ...new Set(todasLinhas.map((l) => l.cliente).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const tiposServicoOpcoes = [...CATEGORIAS_TIPO_SERVICO];

  return {
    resumo: {
      valorBrutoTotal,
      quantidadeTotal,
      ticketMedio,
      valorMedioMensal,
      naoConcluidosQtd: naoConcluidos.length,
      naoConcluidosValor: naoConcluidos.reduce((s, l) => s + l.valor, 0),
      concluidosQtd: concluidos.length,
      concluidosValor: concluidos.reduce((s, l) => s + l.valor, 0),
    },
    evolucaoMensal,
    distribuicaoTipo,
    statusResumo: {
      naoConcluidos: {
        quantidade: naoConcluidos.length,
        valor: naoConcluidos.reduce((s, l) => s + l.valor, 0),
        percentual: pct(naoConcluidos.reduce((s, l) => s + l.valor, 0)),
      },
      concluidos: {
        quantidade: concluidos.length,
        valor: concluidos.reduce((s, l) => s + l.valor, 0),
        percentual: pct(concluidos.reduce((s, l) => s + l.valor, 0)),
      },
    },
    tabelaPorMes: evolucaoMensal,
    tabelaPorTipo: distribuicaoTipo.map((d) => ({
      servico: d.tipo,
      quantidade: d.quantidade,
      valor: d.valor,
      percentual: d.percentual,
    })),
    detalhes: linhas,
    clientesOpcoes,
    tiposServicoOpcoes,
  };
}

export function formatarMoedaFinanceiroGeral(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatarNumeroFinanceiroGeral(valor: number, casas = 2) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function formatarPercentualFinanceiroGeral(valor: number) {
  return `${formatarNumeroFinanceiroGeral(valor, 1)}%`;
}

export function periodoTextoFinanceiroGeral(filtros: FiltrosRelatorioFinanceiroGeral) {
  return `${filtros.dataInicio} a ${filtros.dataFim}`;
}
