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
import {
  calcularFinanceiroLancamentosPeriodo,
  type FinanceiroLancamentosPeriodo,
  type LancamentoRelatorioFinanceiro,
} from "@/lib/financeiro-lancamentos-relatorio";
import { itensDaOsModulo, type TrabalhoModuloOs } from "@/lib/modulo-producao-os";
import { indiceEtapaAtualDeConcluidas } from "@/lib/modulo-producao-etapas";
import { calcularNaoFaturadosContasReceber } from "@/lib/nao-faturados-contas-receber";
import {
  idsTrabalhosFaturadosNoLancamento,
  lancamentoFaturaOsAtivo,
  numerosOsDoLancamentoFatura,
  type LancamentoFaturaOs,
} from "@/lib/os-faturamento";
import { normalizarChaveStatusOs, labelStatusOs } from "@/lib/status-os";
import {
  classificarItemOs,
  parseDescontoTipoLinhaItem,
  parseItensAdicionadosLinhas,
  segmentoEfetivoTrabalho,
  servicoFinalizadoParaCobranca,
  valorLiquidoDeLinhaItemAdicionado,
  valorLiquidoItemOs,
} from "@/lib/trabalho-os-segmento";

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
  grupoOsId?: string | null;
  dataEntrada: string;
  dataPrevista: string | null;
  dataEntrega: string | null;
  updatedAt?: string | null;
  instrucoes: string | null;
  clienteId?: string | null;
  clienteNome: string;
  clienteAtivo?: boolean | null;
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

/** Não finalizados + finalizados não faturados + valor bruto do mês. */
export type MesProducaoBrutaFinanceiroGeral = {
  mes: string;
  mesIdx: number;
  ano: number;
  naoFinalizados: number;
  finalizadosNaoFaturados: number;
  valorBruto: number;
  quantidadeNaoFinalizados: number;
  quantidadeFinalizados: number;
};

export type RelatorioFinanceiroGeralPayload = {
  resumo: {
    /** Soma de tudo em produção no laboratório (exceto finalizados/entregues). */
    valorBrutoTotal: number;
    /** Quantidade de OS ainda em produção no laboratório. */
    quantidadeTotal: number;
    /** Quantidade total de OS geradas no laboratório. */
    quantidadeOsGeradas: number;
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
  /** Trabalhos não finalizados e finalizados não faturados, somados no valor bruto do mês. */
  tabelaProducaoBrutaMes: MesProducaoBrutaFinanceiroGeral[];
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

/** Concluído no financeiro = apenas Finalizado ou Entregue (não inclui Saiu para Entrega). */
export const STATUS_SERVICO_CONCLUIDO_FINANCEIRO = ["finalizado", "entregue"] as const;

export function servicoConcluidoFinanceiro(status?: string | null) {
  const key = normalizarChaveStatusOs(status);
  return (STATUS_SERVICO_CONCLUIDO_FINANCEIRO as readonly string[]).includes(key);
}

function trabalhoParaModuloOs(trabalho: TrabalhoFinanceiroGeralInput): TrabalhoModuloOs {
  return {
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
}

/** Situação efetiva: status salvo na OS ou situação do item de serviço nas instruções. */
export function statusEfetivoTrabalhoFinanceiro(trabalho: TrabalhoFinanceiroGeralInput): string {
  const statusSalvo = normalizarChaveStatusOs(trabalho.status);
  if (servicoConcluidoFinanceiro(statusSalvo)) return statusSalvo;

  const itens = itensDaOsModulo(trabalhoParaModuloOs(trabalho)).filter(
    (item) => item.tipo === "trabalho"
  );
  for (const item of itens) {
    const situacao = normalizarChaveStatusOs(item.situacao);
    if (servicoConcluidoFinanceiro(situacao)) return situacao;
  }

  return statusSalvo;
}

const META_TRABALHOS_COBRANCA = /@@trab:([a-zA-Z0-9_,-]+)@@/;

function toLancamentoFaturaOs(l: LancamentoRelatorioFinanceiro): LancamentoFaturaOs {
  return {
    id: l.id,
    status: l.status,
    descricao: l.descricao ?? "",
    tipo: l.tipo,
    trabalho: l.trabalhoId
      ? { id: l.trabalhoId, numeroOs: l.trabalhoNumeroOs ?? undefined }
      : null,
  };
}

/** Cobrança legado (sem @@trab) só fatura o segmento serviço; produto/transporte seguem a receber. */
function trabalhoEstaFaturadoRelatorio(
  trabalho: TrabalhoFinanceiroGeralInput,
  lancamentos: LancamentoRelatorioFinanceiro[]
): boolean {
  return lancamentos.some((lancamentoRaw) => {
    const lancamento = toLancamentoFaturaOs(lancamentoRaw);
    if (!lancamentoFaturaOsAtivo(lancamento)) return false;
    const ids = idsTrabalhosFaturadosNoLancamento(lancamento);
    const temMetaIds = META_TRABALHOS_COBRANCA.test(lancamento.descricao);
    if (temMetaIds) return ids.includes(trabalho.id);
    if (ids.length > 0 && ids.includes(trabalho.id)) return true;
    if (segmentoEfetivoTrabalho(trabalho) !== "servico") return false;
    return numerosOsDoLancamentoFatura(lancamento).includes(trabalho.numeroOs);
  });
}

function valorEmbutidoSegmentosOs(
  segmentosOs: TrabalhoFinanceiroGeralInput[],
  segmento: "produto" | "transporte"
): number {
  if (segmentosOs.some((t) => segmentoEfetivoTrabalho(t) === segmento)) return 0;
  return segmentosOs
    .filter((t) => segmentoEfetivoTrabalho(t) === "servico")
    .reduce((s, t) => s + valorTotalSegmentoInstrucoes(t.instrucoes, segmento), 0);
}

function valorTotalSegmentoInstrucoes(
  instrucoes: string | null | undefined,
  segmento: "servico" | "produto" | "transporte"
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

  const embutidoProduto = valorEmbutidoSegmentosOs(segmentosOs, "produto");
  const embutidoTransporte = valorEmbutidoSegmentosOs(segmentosOs, "transporte");

  let valorNaoFaturado = embutidoProduto + embutidoTransporte;
  for (const t of segmentosOs) {
    if (trabalhoEstaFaturadoRelatorio(t, lancamentos)) continue;
    valorNaoFaturado += valorTrabalhoSegmentoFinanceiro(t);
  }

  return saldoFaturas + valorNaoFaturado;
}

function dataConclusaoTrabalho(trabalho: TrabalhoFinanceiroGeralInput) {
  const status = statusEfetivoTrabalhoFinanceiro(trabalho);
  if (!servicoConcluidoFinanceiro(status)) return null;
  if (trabalho.dataEntrega) {
    const entrega = parseDataEntrada(trabalho.dataEntrega);
    if (entrega) return entrega;
  }
  if (trabalho.updatedAt) {
    const atualizado = parseDataEntrada(trabalho.updatedAt);
    if (atualizado) return atualizado;
  }
  return parseDataEntrada(trabalho.dataEntrada);
}

function linhaNoPeriodo(
  linha: LinhaDetalheFinanceiroGeral,
  inicio: Date,
  fim: Date
) {
  if (linha.concluido) {
    // Mesma visão do Contas a Receber: finalizados não faturados sem filtro de data.
    return linha.valor > 0.005;
  }

  // Em produção no laboratório: inclui tudo ainda não finalizado que já havia entrado
  // até o fim do período (não exige entrada dentro do intervalo).
  const entrada = parseBrDate(linha.dataEntrada);
  if (!entrada) return false;
  return entrada <= fim;
}

/** Mês vigente dentro do período do filtro (snapshot do Contas a Receber). */
function mesVigenteNoPeriodo(mesesPeriodo: { ano: number; mesIdx: number }[]) {
  if (!mesesPeriodo.length) return undefined;
  const agora = new Date();
  const ano = agora.getFullYear();
  const mesIdx = agora.getMonth();
  return (
    mesesPeriodo.find((m) => m.ano === ano && m.mesIdx === mesIdx) ??
    mesesPeriodo[mesesPeriodo.length - 1]
  );
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

  /** Mesma base do Contas a Receber: serviço + produto + transporte não faturados. */
  const naoFaturadosResumo = calcularNaoFaturadosContasReceber(
    trabalhos,
    lancamentos.map(toLancamentoFaturaOs)
  );
  const valorNaoFaturadoPorOs = naoFaturadosResumo.valorPorOs;

  /** Produção em aberto: serviço + produto + transporte (sem contar embutidos em dobro). */
  const valorProducaoPorOs = new Map<number, number>();
  const osVistas = new Set<number>();
  for (const t of trabalhos) {
    if (normalizarChaveStatusOs(t.status) === "cancelado") continue;
    if (osVistas.has(t.numeroOs)) continue;
    osVistas.add(t.numeroOs);

    const segmentosOs = trabalhos.filter(
      (seg) =>
        seg.numeroOs === t.numeroOs &&
        normalizarChaveStatusOs(seg.status) !== "cancelado"
    );
    const embutidoProduto = valorEmbutidoSegmentosOs(segmentosOs, "produto");
    const embutidoTransporte = valorEmbutidoSegmentosOs(segmentosOs, "transporte");
    const totalSegmentos = segmentosOs.reduce(
      (soma, seg) => soma + valorTrabalhoSegmentoFinanceiro(seg),
      0
    );
    valorProducaoPorOs.set(
      t.numeroOs,
      totalSegmentos + embutidoProduto + embutidoTransporte
    );
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
      const statusEfetivo = statusEfetivoTrabalhoFinanceiro(t);
      // Mesmo critério do Contas a Receber (status salvo na OS, não só situação do item).
      const concluido = servicoFinalizadoParaCobranca(normalizarChaveStatusOs(t.status));
      const conclusao = concluido ? dataConclusaoTrabalho(t) : null;
      const { etapaAtual, responsavel } = resolverEtapaResponsavel(t, mapaEtapas);
      const ehPrimeiroServico = primeiroServicoIdPorOs.get(t.numeroOs) === t.id;
      const valor = !ehPrimeiroServico
        ? 0
        : concluido
          ? (valorNaoFaturadoPorOs.get(t.numeroOs) ?? 0)
          : (valorProducaoPorOs.get(t.numeroOs) ?? 0);
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
        status: statusEfetivo,
        statusLabel: labelStatusOs(statusEfetivo),
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

  // Igual Contas a Receber: cliente inativo/excluído não entra.
  const trabalhosEscopo = trabalhos.filter((t) => t.clienteAtivo !== false);

  const todasLinhasBase = montarLinhasDetalhe(trabalhosEscopo, mapaEtapas, lancamentos);
  const todasLinhas = todasLinhasBase.filter((linha) =>
    linhaNoPeriodo(linha, inicio, fim)
  );

  const linhas = todasLinhas.filter((l) => passaFiltros(l, filtros));

  const naoConcluidos = linhas.filter((l) => !l.concluido);
  const concluidos = linhas.filter((l) => l.concluido && l.valor > 0.005);

  const naoConcluidosValor = naoConcluidos.reduce((s, l) => s + l.valor, 0);

  /** Fonte única com Contas a Receber (serviço + produto + transporte). */
  const naoFaturadosResumo = calcularNaoFaturadosContasReceber(
    trabalhosEscopo,
    lancamentos.map(toLancamentoFaturaOs)
  );

  const usaFiltroExtra =
    (filtros.cliente && filtros.cliente !== "Todos") ||
    (filtros.tipoServico && filtros.tipoServico !== "Todos") ||
    (filtros.status && filtros.status !== "Todos");

  const concluidosValor = usaFiltroExtra
    ? concluidos.reduce((s, l) => s + l.valor, 0)
    : naoFaturadosResumo.valor;
  const concluidosQtd = usaFiltroExtra
    ? concluidos.length
    : naoFaturadosResumo.quantidadeOs;

  /** Valor bruto total = tudo em produção no lab (exceto finalizados/entregues). */
  const valorBrutoTotal = naoConcluidosValor;
  const quantidadeTotal = naoConcluidos.length;
  const ticketMedio = quantidadeTotal > 0 ? valorBrutoTotal / quantidadeTotal : 0;
  const baseStatus = naoConcluidosValor + concluidosValor;

  /** OS geradas no laboratório (únicas por número), independentemente do período. */
  const quantidadeOsGeradas = new Set(
    todasLinhasBase.filter((l) => passaFiltros(l, filtros)).map((l) => l.numeroOs)
  ).size;

  const mesesPeriodo = mesesNoPeriodo(inicio, fim);
  const mesVigente = mesVigenteNoPeriodo(mesesPeriodo);
  const valorMedioMensal =
    mesesPeriodo.length > 0 ? valorBrutoTotal / mesesPeriodo.length : 0;

  const evolucaoMensal: MesValorFinanceiroGeral[] = mesesPeriodo.map(({ ano, mesIdx, label }) => {
    const doMesNao = linhas.filter(
      (l) => !l.concluido && l.anoEntrada === ano && l.mesEntrada === mesIdx
    );
    // OS em produção que entraram antes do período vão no primeiro mês exibido.
    const doMesNaoAnteriores =
      mesIdx === mesesPeriodo[0]?.mesIdx && ano === mesesPeriodo[0]?.ano
        ? linhas.filter((l) => {
            if (l.concluido) return false;
            const antesDoPeriodo =
              l.anoEntrada < inicio.getFullYear() ||
              (l.anoEntrada === inicio.getFullYear() && l.mesEntrada < inicio.getMonth());
            return antesDoPeriodo;
          })
        : [];
    const naoDoMes = [...doMesNao, ...doMesNaoAnteriores];
    // Contas a Receber é snapshot: todo o não faturado fica no mês vigente.
    const ehMesVigente =
      !!mesVigente && mesVigente.ano === ano && mesVigente.mesIdx === mesIdx;
    const valorNao = naoDoMes.reduce((s, l) => s + l.valor, 0);
    const valorSim = ehMesVigente ? concluidosValor : 0;
    const qtdSim = ehMesVigente ? concluidosQtd : 0;
    const total = valorNao + valorSim;
    const qtd = naoDoMes.length + qtdSim;
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

  const tabelaProducaoBrutaMes: MesProducaoBrutaFinanceiroGeral[] = evolucaoMensal.map((m, idx) => {
    const doMesNao = linhas.filter(
      (l) => !l.concluido && l.anoEntrada === m.ano && l.mesEntrada === m.mesIdx
    );
    const doMesNaoAnteriores =
      idx === 0
        ? linhas.filter((l) => {
            if (l.concluido) return false;
            const antesDoPeriodo =
              l.anoEntrada < inicio.getFullYear() ||
              (l.anoEntrada === inicio.getFullYear() && l.mesEntrada < inicio.getMonth());
            return antesDoPeriodo;
          })
        : [];
    const quantidadeNaoFinalizados = doMesNao.length + doMesNaoAnteriores.length;
    const ehMesVigente =
      !!mesVigente && mesVigente.ano === m.ano && mesVigente.mesIdx === m.mesIdx;
    return {
      mes: m.mes,
      mesIdx: m.mesIdx,
      ano: m.ano,
      naoFinalizados: m.naoConcluido,
      finalizadosNaoFaturados: m.concluido,
      valorBruto: m.total,
      quantidadeNaoFinalizados,
      quantidadeFinalizados: ehMesVigente ? concluidosQtd : 0,
    };
  });

  const mapaTipo = new Map<CategoriaTipoServico, { quantidade: number; valor: number }>();
  for (const cat of CATEGORIAS_TIPO_SERVICO) {
    mapaTipo.set(cat, { quantidade: 0, valor: 0 });
  }
  // Distribuição por tipo: serviços em produção no laboratório.
  for (const linha of naoConcluidos) {
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

  const pct = (valor: number) => (baseStatus > 0 ? (valor / baseStatus) * 100 : 0);

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
      quantidadeOsGeradas,
      ticketMedio,
      valorMedioMensal,
      naoConcluidosQtd: naoConcluidos.length,
      naoConcluidosValor,
      concluidosQtd,
      concluidosValor,
    },
    evolucaoMensal,
    distribuicaoTipo,
    statusResumo: {
      naoConcluidos: {
        quantidade: naoConcluidos.length,
        valor: naoConcluidosValor,
        percentual: pct(naoConcluidosValor),
      },
      concluidos: {
        quantidade: concluidosQtd,
        valor: concluidosValor,
        percentual: pct(concluidosValor),
      },
    },
    tabelaPorMes: evolucaoMensal,
    tabelaProducaoBrutaMes,
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
