import { dateToBrShort, parseBrDate } from "@/lib/datas-br";
import { parseCurrencyBr } from "@/lib/cliente-financeiro";
import {
  ehCobrancaOsReceita,
  saldoFaturaCobrancaOs,
  type LancamentoFinanceiroResumo,
} from "@/lib/dashboard-financeiro";
import {
  nomeEtapaSemSetor,
  parseComplementosInstrucoesGrupo,
} from "@/lib/etapas-os";
import { itensDaOsModulo } from "@/lib/modulo-producao-os";
import { indiceEtapaAtualDeConcluidas } from "@/lib/modulo-producao-etapas";
import { normalizarChaveStatusOs, labelStatusOs } from "@/lib/status-os";
import {
  classificarItemOs,
  parseDescontoTipoLinhaItem,
  parseItensAdicionadosLinhas,
  segmentoEfetivoTrabalho,
  valorLiquidoItemOs,
  type SegmentoFaturamento,
} from "@/lib/trabalho-os-segmento";
import {
  numerosOsDoLancamentoFatura,
  trabalhoEstaFaturado,
} from "@/lib/os-faturamento";
import {
  calcularFinanceiroLancamentosPeriodo,
  type FinanceiroLancamentosPeriodo,
  type LancamentoRelatorioFinanceiro,
} from "@/lib/financeiro-lancamentos-relatorio";

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
  dataConclusao: string;
  prazo: string;
  diasProducao: number;
  status: string;
  statusLabel: string;
  etapaAtual: string;
  responsavel: string;
  concluido: boolean;
  mesEntrada: number;
  anoEntrada: number;
  mesConclusao: number;
  anoConclusao: number;
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
  /** Receitas e despesas pagas no Financeiro (lançamentos com status Pago). */
  financeiroRealizado: FinanceiroLancamentosPeriodo;
};

export const STATUS_SERVICO_CONCLUIDO_FINANCEIRO = [
  "finalizado",
  "saiu_entrega",
  "entregue",
  "recebido_cliente",
] as const;

export function servicoConcluidoFinanceiro(status?: string | null) {
  const key = normalizarChaveStatusOs(status);
  return (STATUS_SERVICO_CONCLUIDO_FINANCEIRO as readonly string[]).includes(key);
}

function valorLiquidoDeLinhaItemAdicionado(line: string): number | null {
  const match = line.match(/^Item adicionado:\s*(.*?)\s*-\s*dentes/i);
  if (!match) return null;

  const valorTexto = line.match(
    / - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
  )?.[1];
  if (!valorTexto) return null;

  const valor = parseCurrencyBr(valorTexto);
  const descontoRaw = line
    .match(
      / - desc (.*?)(?: - descTipo| - categoria| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
    )?.[1]
    ?.trim();
  const descontoTipo = parseDescontoTipoLinhaItem(line, descontoRaw || "");
  return valorLiquidoItemOs({ valor, desconto: descontoRaw, descontoTipo });
}

function valorTotalSegmentoInstrucoes(
  instrucoes: string | null | undefined,
  segmento: SegmentoFaturamento
): number {
  let total = 0;
  for (const line of parseItensAdicionadosLinhas(instrucoes)) {
    const match = line.match(/^Item adicionado:\s*(.*?)\s*-\s*dentes/i);
    const servico = match?.[1]?.trim() || "";
    const produtoId = line
      .match(/ - produtoId (.*?)(?: - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]
      ?.trim();
    if (classificarItemOs({ servico, produtoId: produtoId || undefined }) !== segmento) {
      continue;
    }
    const liquido = valorLiquidoDeLinhaItemAdicionado(line);
    if (liquido != null) total += liquido;
  }
  return total;
}

/** Valor do segmento (serviço, produto ou transporte) nas instruções da OS. */
export function valorTrabalhoSegmentoFinanceiro(
  trabalho: TrabalhoFinanceiroGeralInput
): number {
  const segmento = segmentoEfetivoTrabalho(trabalho);
  const total = valorTotalSegmentoInstrucoes(trabalho.instrucoes, segmento);
  if (total > 0) return total;
  return Number(trabalho.valor) || 0;
}

function valorLiquidoLinhaItemOs(instrucoes: string, descricaoItem: string) {
  const alvo = descricaoItem.trim().toLowerCase();
  for (const line of (instrucoes || "").split("\n")) {
    const texto = line.trim();
    if (!texto.startsWith("Item adicionado:")) continue;

    const matchServico = texto.match(/^Item adicionado:\s*(.*?)\s*-\s*dentes/i);
    const servico = matchServico?.[1]?.trim() || "";
    const produtoId = texto
      .match(/ - produtoId (.*?)(?: - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]
      ?.trim();
    const itemLinha = { servico, produtoId: produtoId || undefined };
    if (classificarItemOs(itemLinha) !== "servico") continue;

    const servicoNorm = servico.toLowerCase();
    if (
      servicoNorm &&
      alvo &&
      !servicoNorm.includes(alvo) &&
      !alvo.includes(servicoNorm.replace(/^produto:\s*/i, ""))
    ) {
      continue;
    }

    const valorTexto = texto.match(
      / - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
    )?.[1];
    if (!valorTexto) continue;

    const valor = parseCurrencyBr(valorTexto);
    const descontoRaw = texto
      .match(
        / - desc (.*?)(?: - descTipo| - categoria| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
      )?.[1]
      ?.trim();
    const descontoTipo = parseDescontoTipoLinhaItem(texto, descontoRaw || "");
    return valorLiquidoItemOs({ valor, desconto: descontoRaw, descontoTipo });
  }
  return 0;
}

/** Valor real do serviço: itens da OS nas instruções (com desconto) ou campo valor do trabalho. */
export function valorServicoTrabalhoFinanceiro(trabalho: TrabalhoFinanceiroGeralInput): number {
  const moduloOs = {
    id: trabalho.id,
    numeroOs: trabalho.numeroOs,
    tipoProtese: trabalho.tipoProtese,
    valor: trabalho.valor,
    status: trabalho.status,
    instrucoes: trabalho.instrucoes,
    dataPrevista: trabalho.dataPrevista,
    cliente: { nome: trabalho.clienteNome },
    paciente: { nome: trabalho.pacienteNome },
  };

  const itens = itensDaOsModulo(moduloOs).filter((item) => item.tipo === "trabalho");
  const lista =
    itens.length > 0
      ? itens
      : [
          {
            id: `${trabalho.id}-principal`,
            descricao: trabalho.tipoProtese,
            qtd: "1",
            situacao: trabalho.status,
            tipo: "trabalho" as const,
          },
        ];

  let total = 0;
  for (const item of lista) {
    total += valorLiquidoLinhaItemOs(trabalho.instrucoes || "", item.descricao);
  }

  if (total > 0) return total;
  return Number(trabalho.valor) || 0;
}

function toLancamentoResumo(l: LancamentoRelatorioFinanceiro): LancamentoFinanceiroResumo {
  return {
    id: l.id,
    tipo: l.tipo,
    descricao: l.descricao ?? "",
    valor: l.valor,
    data: l.data,
    status: l.status,
    formaPagamento: l.formaPagamento ?? null,
    clienteId: l.clienteId ?? null,
    trabalhoId: l.trabalhoId ?? null,
    trabalhoNumeroOs: l.trabalhoNumeroOs ?? null,
  };
}

function faturaLigadaAoTrabalho(
  lancamento: LancamentoFinanceiroResumo,
  trabalho: Pick<TrabalhoFinanceiroGeralInput, "id" | "numeroOs">
) {
  if (lancamento.trabalhoId === trabalho.id) return true;
  if (lancamento.trabalhoNumeroOs === trabalho.numeroOs) return true;
  return numerosOsDoLancamentoFatura(lancamento).includes(trabalho.numeroOs);
}

/** Saldo em Contas a Receber da OS; se ainda não faturada, usa o valor do serviço. */
export function valorAReceberTrabalhoFinanceiro(
  trabalho: TrabalhoFinanceiroGeralInput,
  lancamentos: LancamentoRelatorioFinanceiro[]
): number {
  const resumos = lancamentos.map(toLancamentoResumo);
  let total = 0;
  let temFatura = false;

  for (const l of resumos) {
    if (!ehCobrancaOsReceita(l)) continue;
    if (!faturaLigadaAoTrabalho(l, trabalho)) continue;
    temFatura = true;
    total += saldoFaturaCobrancaOs(l, resumos);
  }

  if (total > 0.005) return total;
  if (!temFatura) return valorServicoTrabalhoFinanceiro(trabalho);
  return 0;
}

/**
 * Saldo a receber de todos os segmentos da OS (serviço + produto + transporte),
 * contando cada fatura de cobrança uma única vez.
 */
export function valorAReceberNumeroOsCompleto(
  numeroOs: number,
  todosTrabalhos: TrabalhoFinanceiroGeralInput[],
  lancamentos: LancamentoRelatorioFinanceiro[]
): number {
  const segmentosOs = todosTrabalhos.filter(
    (t) =>
      t.numeroOs === numeroOs && normalizarChaveStatusOs(t.status) !== "cancelado"
  );
  if (!segmentosOs.length) return 0;

  const resumos = lancamentos.map(toLancamentoResumo);
  let saldoFaturas = 0;
  const faturasVistas = new Set<string>();

  for (const l of resumos) {
    if (!ehCobrancaOsReceita(l)) continue;
    if (!segmentosOs.some((t) => faturaLigadaAoTrabalho(l, t))) continue;
    if (faturasVistas.has(l.id)) continue;
    faturasVistas.add(l.id);
    saldoFaturas += saldoFaturaCobrancaOs(l, resumos);
  }

  let valorNaoFaturado = 0;
  for (const t of segmentosOs) {
    if (trabalhoEstaFaturado(t, lancamentos)) continue;
    valorNaoFaturado += valorTrabalhoSegmentoFinanceiro(t);
  }

  return saldoFaturas + valorNaoFaturado;
}

function valorLinhaConcluidaFinanceiro(
  trabalho: TrabalhoFinanceiroGeralInput,
  todosTrabalhos: TrabalhoFinanceiroGeralInput[],
  lancamentos: LancamentoRelatorioFinanceiro[],
  primeiroServicoIdPorOs: Map<number, string>
): number {
  const totalOs = valorAReceberNumeroOsCompleto(
    trabalho.numeroOs,
    todosTrabalhos,
    lancamentos
  );

  if (primeiroServicoIdPorOs.get(trabalho.numeroOs) !== trabalho.id) {
    return valorAReceberTrabalhoFinanceiro(trabalho, lancamentos);
  }

  const outrosServicos = todosTrabalhos.filter(
    (t) =>
      t.numeroOs === trabalho.numeroOs &&
      t.id !== trabalho.id &&
      segmentoEfetivoTrabalho(t) === "servico" &&
      servicoConcluidoFinanceiro(t.status) &&
      normalizarChaveStatusOs(t.status) !== "cancelado"
  );

  const recebivelOutros = outrosServicos.reduce(
    (s, t) => s + valorAReceberTrabalhoFinanceiro(t, lancamentos),
    0
  );

  return Math.max(0, totalOs - recebivelOutros);
}

function dataConclusaoTrabalho(trabalho: TrabalhoFinanceiroGeralInput) {
  if (!servicoConcluidoFinanceiro(trabalho.status)) return null;
  if (trabalho.dataEntrega) {
    const entrega = parseDataEntrada(trabalho.dataEntrega);
    if (entrega) return entrega;
  }
  return parseDataEntrada(trabalho.dataEntrada);
}

function linhaNoPeriodo(
  linha: LinhaDetalheFinanceiroGeral,
  inicio: Date,
  fim: Date
) {
  if (linha.concluido) {
    const conclusao = parseBrDate(linha.dataConclusao);
    if (!conclusao) return false;
    return conclusao >= inicio && conclusao <= fim;
  }

  const entrada = parseBrDate(linha.dataEntrada);
  if (!entrada) return false;
  return entrada >= inicio && entrada <= fim;
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
  mapaEtapas: Record<string, number[]> = {},
  lancamentos: LancamentoRelatorioFinanceiro[] = []
): LinhaDetalheFinanceiroGeral[] {
  const primeiroServicoIdPorOs = new Map<number, string>();
  for (const t of trabalhos) {
    if (segmentoEfetivoTrabalho(t) !== "servico") continue;
    if (normalizarChaveStatusOs(t.status) === "cancelado") continue;
    if (!primeiroServicoIdPorOs.has(t.numeroOs)) {
      primeiroServicoIdPorOs.set(t.numeroOs, t.id);
    }
  }

  return trabalhos
    .filter(
      (t) =>
        segmentoEfetivoTrabalho({
          segmentoFaturamento: t.segmentoFaturamento,
          instrucoes: t.instrucoes,
        }) === "servico"
    )
    .filter((t) => normalizarChaveStatusOs(t.status) !== "cancelado")
    .map((t) => {
      const entrada = parseDataEntrada(t.dataEntrada);
      const entrega = t.dataEntrega ? parseDataEntrada(t.dataEntrega) : null;
      const concluido = servicoConcluidoFinanceiro(t.status);
      const conclusao = dataConclusaoTrabalho(t);
      const { etapaAtual, responsavel } = resolverEtapaResponsavel(t, mapaEtapas);
      const valorProducao = valorServicoTrabalhoFinanceiro(t);
      const valor = concluido
        ? valorLinhaConcluidaFinanceiro(t, trabalhos, lancamentos, primeiroServicoIdPorOs)
        : valorProducao;
      return {
        id: t.id,
        numeroOs: t.numeroOs,
        cliente: t.clienteNome,
        servico: t.tipoProtese,
        valor,
        dataEntrada: entrada ? dateToBrShort(entrada) : "—",
        dataConclusao: conclusao ? dateToBrShort(conclusao) : "—",
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
        mesConclusao: conclusao?.getMonth() ?? 0,
        anoConclusao: conclusao?.getFullYear() ?? new Date().getFullYear(),
        categoriaServico: categorizarTipoServico(t.tipoProtese),
      };
    });
}

export function calcularRelatorioFinanceiroGeral(
  trabalhos: TrabalhoFinanceiroGeralInput[],
  filtros: FiltrosRelatorioFinanceiroGeral,
  mapaEtapas: Record<string, number[]> = {},
  lancamentos: LancamentoRelatorioFinanceiro[] = []
): RelatorioFinanceiroGeralPayload {
  const inicio =
    parseBrDate(filtros.dataInicio) ??
    new Date(new Date().getFullYear(), 0, 1);
  const fim =
    parseBrDate(filtros.dataFim) ?? new Date(new Date().getFullYear(), 11, 31);
  fim.setHours(23, 59, 59, 999);

  const todasLinhas = montarLinhasDetalhe(trabalhos, mapaEtapas, lancamentos).filter((linha) =>
    linhaNoPeriodo(linha, inicio, fim)
  );

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
    const doMesNao = linhas.filter(
      (l) => !l.concluido && l.anoEntrada === ano && l.mesEntrada === mesIdx
    );
    const doMesSim = linhas.filter(
      (l) => l.concluido && l.anoConclusao === ano && l.mesConclusao === mesIdx
    );
    const valorNao = doMesNao.reduce((s, l) => s + l.valor, 0);
    const valorSim = doMesSim.reduce((s, l) => s + l.valor, 0);
    const total = valorNao + valorSim;
    const qtd = doMesNao.length + doMesSim.length;
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

  const financeiroRealizado = calcularFinanceiroLancamentosPeriodo(
    lancamentos,
    filtros.dataInicio,
    filtros.dataFim,
    MESES_FINANCEIRO_GERAL
  );

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
    financeiroRealizado,
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
