"use client";

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Eye,
  FileText,
  ListTree,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
} from "lucide-react";
import { BotoesImprimirExportarToolbar } from "@/components/BotoesImprimirExportarToolbar";
import { MovimentacoesRecebimentoModal } from "@/components/financeiro/MovimentacoesRecebimentoModal";
import {
  ContaBancariaConteudoLazy,
  ContaDigitalConteudoLazy,
  ConfirmacaoExclusaoModalLazy,
  ContasPagarConteudoLazy,
  ControleBoletosConteudoLazy,
  ImprimirFaturaModalLazy,
  ImprimirReciboModalLazy,
  ItensFaturaModalLazy,
  LancarRecebimentoModalLazy,
  LancarReceitaOsModalLazy,
  PlanoContasConteudoLazy,
  RelatorioContasReceberModalLazy,
  ServicosNaoFaturadosModalLazy,
  VisualizacaoClienteReceberModalLazy,
} from "@/components/financeiro/financeiro-lazy";
import type {
  LancarRecebimentoConfirmacao,
  LancamentoRecebimento,
} from "@/components/financeiro/LancarRecebimentoModal";
import type {
  LancarReceitaOsSubmit,
  ParcelaLinhaReceita,
} from "@/components/financeiro/LancarReceitaOsModal";
import {
  Button,
  CampoDataBr,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { brShortToIso, dateToBrShort, formatDateBr, parseBrDate } from "@/lib/datas-br";
import {
  empacotarCobrancaOs,
  idsTrabalhosFaturadosNoLancamento,
  lancamentoFaturaOsAtivo,
  trabalhoEstaFaturado,
  trabalhosRelacionadosLancamentoFatura,
} from "@/lib/os-faturamento";
import {
  filtrarTrabalhoPorSituacaoFaturamento,
  listarTrabalhosNaoFaturados,
  ORDEM_SEGMENTO_FATURAMENTO,
  segmentosCobraveisMesmaOs,
  segmentoEfetivoTrabalho,
  servicoFinalizadoParaCobranca,
  situacaoReceitaVinculaProdutoTransporte,
  type ItemOsLinha,
} from "@/lib/trabalho-os-segmento";
import { cn, formatDate, STATUS_TRABALHO } from "@/lib/utils";
import { carregarConfigLaboratorio } from "@/lib/configuracoes-lab";
import {
  carregarConfiguracoesFaturas,
} from "@/lib/configuracoes-faturas";
import {
  gerarHtmlFaturaImpressao,
  montarDadosFaturaImpressao,
} from "@/lib/fatura-impressao-html";
import {
  calcularCreditoDisponivelClienteFatura,
  calcularSaldoAnteriorFatura,
  calcularUltimoPagamentoClienteFatura,
  FORMA_PAGAMENTO_ABATIMENTO_CREDITO,
} from "@/lib/fatura-cliente-financeiro";
import { htmlCabecalhoLab, labImpressaoFromConfig } from "@/lib/lab-logo";
import { linhasItensFaturaFromTrabalhos } from "@/lib/itens-fatura-linhas";
import {
  itensDoTrabalho,
  valorTrabalho,
} from "@/lib/relatorio-faturas-modelo3-dados";
import { notificarFinanceiroAtualizado } from "@/lib/financeiro-events";
import { adicionarTrabalhoControleEntregasAutomatico } from "@/lib/controle-entregas-automatico-cliente";
import { TRABALHOS_ATUALIZADOS_EVENT } from "@/lib/trabalhos-events";
import {
  desempacotarDespesa,
  empacotarDespesa,
  type AnexoDespesa,
} from "@/lib/lancamento-despesa";
import {
  carregarPlanoContas,
  categoriaPadraoLancamento,
} from "@/lib/plano-contas";
import {
  exportarContasReceberClientesCsv,
  gerarContasReceberClientesPdf,
} from "@/lib/contas-receber-clientes-export";
import { clienteVisivelContasReceber, descricaoExibicaoCobranca, calcularRecebidoCliente, isRecebimentoParcial, deveExibirNoHistoricoRecebimentos, valorHistoricoRecebimentoCliente, referenciaLancamento as referenciaHistoricoRecebimento, recebidoNaFatura as recebidoNaFaturaLib, saldoFatura as saldoFaturaLib, classeReferenciaHistoricoRecebimento, faturaExibeSituacaoParcial, faturasExibicaoPainelCliente, faturaQuitada, recebimentosHistoricoCliente, movimentacoesRecebimentoDaFatura, ehFaturaCobrancaOsParaExclusao, idsLancamentosExclusaoAoRemoverFatura, ehDescricaoFaturaContasReceber, type LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
import { fetchPainelFinanceiro } from "@/lib/financeiro-painel-cliente";
import type { PainelFinanceiroReceita } from "@/lib/financeiro-painel-types";
import { abrirPdfNoVisualizador, prepararAbaPdf } from "@/lib/pdf-viewer";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import type { LinhaReciboRecebimento } from "@/lib/recibo-recebimento";
import { empacotarReceitaConta, descricaoReceitaSemMeta } from "@/lib/receita-conta-bancaria";
import { formaEhPixAsaas } from "@/lib/forma-pagamento-pix";
import {
  PixQrRecebimentoModal,
  type DadosPixQrRecebimento,
} from "@/components/financeiro/PixQrRecebimentoModal";
import { useI18n } from "@/components/i18n-provider";

type CobrancaAsaas = {
  id: string;
  bankSlipUrl?: string | null;
  invoiceUrl?: string | null;
  linhaDigitavel?: string | null;
  statusAsaas?: string;
};

type Lancamento = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  createdAt?: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome: string } | null;
  trabalho?: { id: string; numeroOs: number } | null;
  cobrancaAsaas?: CobrancaAsaas | null;
};

type Cliente = {
  id: string;
  nome: string;
  cro?: string | null;
  celular?: string | null;
};

type Trabalho = {
  id: string;
  numeroOs: number;
  segmentoFaturamento?: string | null;
  tipoProtese: string;
  status: string;
  valor: number;
  dentes?: string | null;
  cor?: string | null;
  material?: string | null;
  observacoes?: string | null;
  instrucoes?: string | null;
  dataPrevista?: string | null;
  dataEntrega?: string | null;
  dataEntrada?: string | null;
  updatedAt?: string | null;
  cliente?: { id?: string; nome?: string | null; cro?: string | null } | null;
  paciente?: { nome?: string | null } | null;
};

type ClienteReceber = {
  clienteId?: string;
  nome: string;
  lancamentos: Lancamento[];
  aReceber: number;
  recebido: number;
  adiantamentos: number;
  naoFaturados: number;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function currency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseDecimal(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized) || 0;
}

function formatDecimalInput(value: string) {
  const amount = Number(value.replace(/\D/g, "")) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrencyInput(value: string) {
  return currency(Number(value.replace(/\D/g, "")) / 100);
}

function parseMoney(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized) || 0;
}

function primeiroItemLinhaReceita(trabalho: Trabalho): ItemOsLinha | null {
  const lines = (trabalho.instrucoes || "").split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("Item adicionado:")) continue;
    const match = t.match(/^Item adicionado:\s*(.*?)\s*-\s*dentes\s/i);
    const servico = match?.[1]?.trim() || trabalho.tipoProtese;
    const produtoId = t
      .match(/ - produtoId (.*?)(?: - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]
      ?.trim();
    return { servico, produtoId: produtoId || undefined };
  }
  return { servico: trabalho.tipoProtese };
}

function itensNotaFromTrabalho(trabalho: Trabalho) {
  return itensDoTrabalho(trabalho).map((item) => ({
    servico: item.descricao,
    dentes: item.numDente,
    quantidade: item.qtd,
    valorUn: item.valorUn,
    subtotal: item.subtotal,
    descPercent: item.descPercent,
  }));
}

function numerosOsDoLancamento(lancamento: Lancamento) {
  const numeros = new Set<number>();
  if (lancamento.trabalho?.numeroOs) numeros.add(lancamento.trabalho.numeroOs);
  const descricao = lancamento.descricao.replace(/\s+/g, " ");
  const match = descricao.match(/cobrança os\s+(.+)$/i);
  if (match) {
    match[1]
      .split(" - ")[0]
      .split(/[,\s]+/)
      .map((value) => Number(value.replace(/\D/g, "")))
      .filter((value) => Number.isFinite(value) && value > 0)
      .forEach((value) => numeros.add(value));
  }
  return Array.from(numeros);
}

function dateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

const formatDateInput = formatDateBr;
const parseBrShortDate = parseBrDate;

function ehRotaContasPagar(searchParams: URLSearchParams) {
  const aba = searchParams.get("aba");
  const tipo = searchParams.get("tipo");
  const acao = searchParams.get("acao");
  return (
    aba === "pagar" ||
    tipo === "despesa" ||
    tipo === "vencidas" ||
    acao === "pagar"
  );
}

function FinanceiroRouter() {
  const searchParams = useSearchParams();
  if (searchParams.get("aba") === "plano-de-contas") {
    return <PlanoContasConteudoLazy />;
  }
  if (
    searchParams.get("aba") === "conta-bancaria" ||
    searchParams.get("aba") === "conta-digital"
  ) {
    return <ContaBancariaConteudoLazy />;
  }
  if (searchParams.get("aba") === "boletos") {
    return <ControleBoletosConteudoLazy />;
  }
  if (ehRotaContasPagar(searchParams)) {
    return <ContasPagarConteudoLazy />;
  }
  return <FinanceiroReceberConteudo />;
}

type SituacaoFaturaKey =
  | "financeiro.receber.situacao.cancelado"
  | "financeiro.receber.situacao.recebido"
  | "financeiro.receber.situacao.parcial"
  | "financeiro.receber.situacao.vencido"
  | "financeiro.receber.situacao.emDia";

function FinanceiroReceberConteudo() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const notifDeepLinkFeito = useRef(false);
  const saveEmAndamentoRef = useRef(false);
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);
  const [data, setData] = useState<{
    lancamentos: Lancamento[];
    resumo: {
      totalReceitas: number;
      totalDespesas: number;
      saldo: number;
      receitasPendentes: number;
    };
  } | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [osSelecionadas, setOsSelecionadas] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [exportandoContasReceberTela, setExportandoContasReceberTela] = useState(false);
  const [modalNaoFaturados, setModalNaoFaturados] = useState(false);
  const [mensagemLancamento, setMensagemLancamento] = useState("");
  const [mensagemLancamentoTipo, setMensagemLancamentoTipo] = useState<
    "sucesso" | "erro" | "info"
  >("info");
  const [recebendoCliente, setRecebendoCliente] = useState<ClienteReceber | null>(null);
  const [detalheCliente, setDetalheCliente] = useState<ClienteReceber | null>(null);
  const [notaCliente, setNotaCliente] = useState<ClienteReceber | null>(null);
  const [itensFatura, setItensFatura] = useState<Lancamento | null>(null);
  const [faturaImprimindo, setFaturaImprimindo] = useState<{
    cliente: ClienteReceber;
    lancamento: Lancamento;
  } | null>(null);
  const [clienteCollapseAberto, setClienteCollapseAberto] = useState<string | null>(null);
  const [faturaEditando, setFaturaEditando] = useState<Lancamento | null>(null);
  const [detalheRecebimento, setDetalheRecebimento] = useState<{
    cliente: ClienteReceber;
    lancamento: Lancamento;
  } | null>(null);
  const [movimentacoesRecebimento, setMovimentacoesRecebimento] = useState<{
    cliente: ClienteReceber;
    fatura: Lancamento;
  } | null>(null);
  const [reciboRecebimento, setReciboRecebimento] = useState<{
    clienteNome: string;
    linhas: LinhaReciboRecebimento[];
  } | null>(null);
  const [pixAsaasDisponivel, setPixAsaasDisponivel] = useState(false);
  const [pixQrRecebimento, setPixQrRecebimento] = useState<DadosPixQrRecebimento | null>(
    null
  );
  const [pixAbrindoLancamentoId, setPixAbrindoLancamentoId] = useState<string | null>(null);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState<{
    title: string;
    message: string;
    aviso?: string;
    detalhe?: string;
    tipoConfirmacao?: "exclusao" | "primario";
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [formEdicaoFatura, setFormEdicaoFatura] = useState({
    descricao: "",
    data: "",
    valor: "",
    formaPagamento: "",
    status: "pendente",
  });
  const [osRemovidasEdicao, setOsRemovidasEdicao] = useState<string[]>([]);
  const [periodo, setPeriodo] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [situacao, setSituacao] = useState("");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState({
    tipo: "receita",
    semOs: false,
    clienteId: "",
    convenio: "",
    categoria: "Receitas de Serviços",
    descricao: "",
    valor: "0,00",
    descontoTipo: "percentual",
    desconto: "0,00",
    jurosTipo: "percentual",
    juros: "0,00",
    acrescimo: false,
    data: dateToBrShort(new Date()),
    pedidoInicio: "",
    pedidoFinal: "",
    situacaoOs: "",
    vencimento: dateToBrShort(new Date()),
    status: "pendente",
    formaPagamento: "Forma Pagamento",
    conta: "Caixa Principal",
    parcela: "1/1",
    observacoes: "",
    recebido: false,
  });

  async function lerJsonResposta<T>(res: Response): Promise<T | null> {
    const texto = await res.text();
    if (!texto.trim()) return null;
    try {
      return JSON.parse(texto) as T;
    } catch {
      return null;
    }
  }

  async function carregarPainelReceita(opts?: { refresh?: boolean }) {
    const painel = await fetchPainelFinanceiro<PainelFinanceiroReceita>("receita", opts);
    if (!painel.ok || !painel.dados.lancamentos) {
      setMensagemLancamentoTipo("erro");
      setMensagemLancamento(
        painel.ok ? "Resposta inválida do painel financeiro." : painel.error
      );
      setData({
        lancamentos: [],
        resumo: { totalReceitas: 0, totalDespesas: 0, saldo: 0, receitasPendentes: 0 },
      });
      return;
    }

    const painelData = painel.dados;
    const lancamentosSerializados = JSON.parse(
      JSON.stringify(painelData.lancamentos)
    ) as typeof painelData.lancamentos;
    setData({
      lancamentos: lancamentosSerializados as unknown as Lancamento[],
      resumo: painelData.resumo || {
        totalReceitas: 0,
        totalDespesas: 0,
        saldo: 0,
        receitasPendentes: 0,
      },
    });
    if (Array.isArray(painelData.clientes)) setClientes(painelData.clientes);
    if (Array.isArray(painelData.trabalhos)) {
      setTrabalhos(JSON.parse(JSON.stringify(painelData.trabalhos)) as Trabalho[]);
    }
  }

  async function load(opts?: { refresh?: boolean }) {
    await carregarPainelReceita(opts);
  }

  async function loadPosMutacao() {
    await carregarPainelReceita({ refresh: true });
    notificarFinanceiroAtualizado();
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void fetch("/api/asaas/pix-cobranca", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { disponivel?: boolean }) => {
        setPixAsaasDisponivel(Boolean(json.disponivel));
      })
      .catch(() => setPixAsaasDisponivel(false));
  }, []);

  useEffect(() => {
    const atualizarDados = () => {
      void loadPosMutacao();
    };
    window.addEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizarDados);
    return () => window.removeEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizarDados);
  }, []);

  useEffect(() => {
    if (!detalheCliente) return;
    void fetch("/api/trabalhos", { cache: "no-store" }).then(async (res) => {
      const trabalhosData = await lerJsonResposta<Trabalho[]>(res);
      if (Array.isArray(trabalhosData)) setTrabalhos(trabalhosData);
    });
  }, [detalheCliente?.clienteId, detalheCliente?.nome]);

  const receitasFiltradas = useMemo(() => {
    const lancamentos = data?.lancamentos.filter((l) => l.tipo === "receita") || [];
    const inicio = dataInicio ? parseBrShortDate(dataInicio) : null;
    const fim = dataFinal ? parseBrShortDate(dataFinal) : null;
    if (inicio) inicio.setHours(0, 0, 0, 0);
    if (fim) fim.setHours(23, 59, 59, 999);
    const termo = busca.trim().toLowerCase();

    return lancamentos.filter((l) => {
      const dataLancamento = new Date(l.data);
      if (inicio && dataLancamento < inicio) return false;
      if (fim && dataLancamento > fim) return false;
      if (situacao === "receber" && l.status === "pago") return false;
      if (situacao === "atraso") {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        if (l.status === "pago" || dateOnly(l.data) >= hoje) return false;
      }
      if (!termo) return true;
      return [
        l.cliente?.nome,
        l.descricao,
        l.trabalho?.numeroOs ? String(l.trabalho.numeroOs) : "",
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(termo));
    });
  }, [data, dataInicio, dataFinal, situacao, busca]);

  const cobrancasAtivas = useMemo(
    () =>
      (data?.lancamentos || []).filter(
        (lancamento) =>
          lancamentoFaturaOsAtivo(lancamento) || isCreditoUtilizado(lancamento)
      ),
    [data]
  );

  const trabalhoJaFaturado = (trabalho: Trabalho) =>
    trabalhoEstaFaturado(trabalho, cobrancasAtivas);

  const trabalhosNaoFaturados = useMemo(
    () => listarTrabalhosNaoFaturados(trabalhos, trabalhoJaFaturado),
    [cobrancasAtivas, trabalhos]
  );

  function passaFiltrosReceita(trabalho: Trabalho) {
    if (form.clienteId && trabalho.cliente?.id !== form.clienteId) return false;
    if (trabalhoJaFaturado(trabalho)) return false;
    const entrega = trabalho.dataPrevista ? new Date(trabalho.dataPrevista) : null;
    const pedidoInicio = form.pedidoInicio ? parseBrShortDate(form.pedidoInicio) : null;
    const pedidoFinal = form.pedidoFinal ? parseBrShortDate(form.pedidoFinal) : null;
    if (pedidoInicio) pedidoInicio.setHours(0, 0, 0, 0);
    if (pedidoFinal) pedidoFinal.setHours(23, 59, 59, 999);
    if (pedidoInicio && entrega && entrega < pedidoInicio) return false;
    if (pedidoFinal && entrega && entrega > pedidoFinal) return false;
    return true;
  }

  function segmentosCobraveisVinculados(trabalhoServico: Trabalho) {
    if (segmentoEfetivoTrabalho(trabalhoServico) !== "servico") return [];
    if (!servicoFinalizadoParaCobranca(trabalhoServico.status)) return [];
    return segmentosCobraveisMesmaOs(trabalhos, trabalhoServico.numeroOs).filter(passaFiltrosReceita);
  }

  function incluirSegmentosVinculados(
    incluidos: Map<string, Trabalho>,
    trabalhoServico: Trabalho
  ) {
    for (const vinculado of segmentosCobraveisVinculados(trabalhoServico)) {
      if (!trabalhoJaFaturado(vinculado)) {
        incluidos.set(vinculado.id, vinculado);
      }
    }
  }

  const trabalhosParaReceita = useMemo(() => {
    if (!form.clienteId || !form.situacaoOs) return [];

    const incluidos = new Map<string, Trabalho>();

    if (situacaoReceitaVinculaProdutoTransporte(form.situacaoOs)) {
      for (const trabalho of trabalhos) {
        if (!passaFiltrosReceita(trabalho)) continue;
        if (segmentoEfetivoTrabalho(trabalho) !== "servico") continue;
        if (trabalho.status !== form.situacaoOs) continue;

        incluidos.set(trabalho.id, trabalho);
        incluirSegmentosVinculados(incluidos, trabalho);
      }
    } else {
      const filtroProdutoOuTransporte =
        form.situacaoOs === "produto" || form.situacaoOs === "transporte";

      for (const trabalho of trabalhos) {
        if (!passaFiltrosReceita(trabalho)) continue;
        if (!filtrarTrabalhoPorSituacaoFaturamento(trabalho, form.situacaoOs)) continue;
        incluidos.set(trabalho.id, trabalho);

        if (!filtroProdutoOuTransporte && segmentoEfetivoTrabalho(trabalho) === "servico") {
          incluirSegmentosVinculados(incluidos, trabalho);
        }
      }
    }

    return Array.from(incluidos.values()).sort((a, b) => {
      if (a.numeroOs !== b.numeroOs) return a.numeroOs - b.numeroOs;
      const segA = segmentoEfetivoTrabalho(a);
      const segB = segmentoEfetivoTrabalho(b);
      return ORDEM_SEGMENTO_FATURAMENTO[segA] - ORDEM_SEGMENTO_FATURAMENTO[segB];
    });
  }, [trabalhos, form.clienteId, form.situacaoOs, form.pedidoInicio, form.pedidoFinal, cobrancasAtivas]);

  const idsReceitaVisiveis = useMemo(
    () => trabalhosParaReceita.map((trabalho) => trabalho.id),
    [trabalhosParaReceita]
  );

  const todasReceitaSelecionadas =
    idsReceitaVisiveis.length > 0 &&
    idsReceitaVisiveis.every((id) => osSelecionadas.includes(id));

  const algumasReceitaSelecionadas = idsReceitaVisiveis.some((id) =>
    osSelecionadas.includes(id)
  );

  function trabalhosDaFatura(lancamento: Lancamento, clienteIdContexto?: string) {
    return trabalhosRelacionadosLancamentoFatura(
      lancamento,
      trabalhos,
      clienteIdContexto || lancamento.cliente?.id
    );
  }

  function complementoDescricaoCobranca(descricao: string) {
    const texto = desempacotarDespesa(descricao).texto
      .replace(/@@trab:[a-zA-Z0-9_,-]+@@/gi, "")
      .trim();
    const lower = texto.toLowerCase();
    if (lower.startsWith("cobrança os")) {
      return texto
        .split(" - ")
        .slice(1)
        .join(" - ")
        .trim();
    }
    if (lower.startsWith("cobrança sem o.s") || lower.startsWith("cobrança sem os")) {
      return texto.replace(/^cobrança\s+sem\s+o\.?s\.?\s*-?\s*/i, "").trim();
    }
    return texto;
  }

  function descricaoCobrancaEditada(trabalhosRelacionados: Trabalho[], descricaoAtual: string) {
    if (!trabalhosRelacionados.length) return descricaoAtual;
    const complemento = complementoDescricaoCobranca(descricaoAtual);
    const base = `Cobrança OS ${trabalhosRelacionados.map((trabalho) => trabalho.numeroOs).join(", ")}${
      complemento ? ` - ${complemento}` : ""
    }`;
    return empacotarCobrancaOs(
      base,
      trabalhosRelacionados.map((trabalho) => trabalho.id)
    );
  }

  useEffect(() => {
    notifDeepLinkFeito.current = false;
  }, [searchParams.toString()]);

  const idsClientesAtivos = useMemo(
    () => new Set(clientes.map((c) => c.id)),
    [clientes]
  );

  const clientesReceber = useMemo(() => {
    const grupos = new Map<string, ClienteReceber>();
    const inicio = dataInicio ? parseBrShortDate(dataInicio) : null;
    const fim = dataFinal ? parseBrShortDate(dataFinal) : null;
    if (inicio) inicio.setHours(0, 0, 0, 0);
    if (fim) fim.setHours(23, 59, 59, 999);
    const todosReceitas = data?.lancamentos.filter((l) => l.tipo === "receita") || [];

    receitasFiltradas.forEach((lancamento) => {
      const clienteId = lancamento.cliente?.id;
      const nome = lancamento.cliente?.nome?.trim();
      if (!clienteId || !nome) return;
      if (idsClientesAtivos.size > 0 && !idsClientesAtivos.has(clienteId)) return;
      const chave = clienteId;
      const grupo = grupos.get(chave) || {
        clienteId: lancamento.cliente?.id,
        nome,
        lancamentos: [],
        aReceber: 0,
        recebido: 0,
        adiantamentos: 0,
        naoFaturados: 0,
      };

      grupo.lancamentos.push(lancamento);
      if (isCreditoGerado(lancamento)) {
        grupos.set(chave, grupo);
        return;
      }
      if (isCreditoUtilizado(lancamento)) {
        grupos.set(chave, grupo);
        return;
      }
      if (!isFaturaContasReceber(lancamento)) {
        grupos.set(chave, grupo);
        return;
      }
      if (lancamento.status !== "pago") {
        grupo.aReceber += saldoFatura(lancamento);
      }
      grupos.set(chave, grupo);
    });

    todosReceitas.forEach((lancamento) => {
      const clienteId = lancamento.cliente?.id;
      if (!clienteId) return;
      const grupo = grupos.get(clienteId);
      if (!grupo) return;
      if (!isCreditoGerado(lancamento) && !isRecebimentoParcial(lancamento)) return;
      if (grupo.lancamentos.some((item) => item.id === lancamento.id)) return;
      grupo.lancamentos.push(lancamento);
    });

    trabalhosNaoFaturados.forEach((trabalho) => {
      const clienteId = trabalho.cliente?.id;
      const nome = trabalho.cliente?.nome?.trim();
      if (!clienteId || !nome) return;
      if (idsClientesAtivos.size > 0 && !idsClientesAtivos.has(clienteId)) return;
      const chave = clienteId;
      const grupo = grupos.get(chave) || {
        clienteId: trabalho.cliente?.id,
        nome,
        lancamentos: [],
        aReceber: 0,
        recebido: 0,
        adiantamentos: 0,
        naoFaturados: 0,
      };
      grupo.naoFaturados += valorTrabalho(trabalho);
      grupos.set(chave, grupo);
    });

    return Array.from(grupos.values())
      .map((grupo) => ({
        ...grupo,
        recebido: grupo.clienteId
          ? calcularRecebidoCliente(grupo.clienteId, todosReceitas, null, null)
          : 0,
        adiantamentos: creditoDisponivelCliente(grupo.clienteId),
      }))
      .filter((grupo) => {
        if (idsClientesAtivos.size > 0 && grupo.clienteId && !idsClientesAtivos.has(grupo.clienteId)) {
          return false;
        }
        return clienteVisivelContasReceber(grupo);
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [receitasFiltradas, trabalhosNaoFaturados, data, dataInicio, dataFinal, idsClientesAtivos]);

  const creditoDisponivelReceita = useMemo(
    () =>
      calcularCreditoDisponivelClienteFatura(data?.lancamentos ?? [], form.clienteId),
    [data, form.clienteId]
  );

  useEffect(() => {
    if (!data || notifDeepLinkFeito.current) return;

    const clienteId = searchParams.get("clienteId");
    const lancamentoId = searchParams.get("lancamentoId");
    const acao = searchParams.get("acao");
    const situacaoParam = searchParams.get("situacao");

    if (!clienteId && !lancamentoId) return;
    notifDeepLinkFeito.current = true;

    if (situacaoParam === "atraso") setSituacao("atraso");

    const cliente =
      (clienteId && clientesReceber.find((c) => c.clienteId === clienteId)) ||
      (lancamentoId
        ? clientesReceber.find((c) =>
            c.lancamentos.some((l) => l.id === lancamentoId)
          )
        : null);

    if (!cliente) return;

    setBusca(cliente.nome);

    if (lancamentoId) {
      const lanc = cliente.lancamentos.find((l) => l.id === lancamentoId);
      if (!lanc) return;
      if (acao === "nota") {
        setNotaCliente({ ...cliente, lancamentos: [lanc] });
      } else if (acao === "receber") {
        setRecebendoCliente(cliente);
      } else {
        setDetalheCliente(cliente);
      }
      return;
    }

    if (acao === "receber") setRecebendoCliente(cliente);
    else if (acao === "faturas" || acao === "nota") setDetalheCliente(cliente);
  }, [data, searchParams, clientesReceber]);

  useEffect(() => {
    if (!detalheCliente) return;
    const chave = clienteKey(detalheCliente);
    const atualizado = clientesReceber.find((c) => clienteKey(c) === chave);
    if (atualizado) setDetalheCliente(atualizado);
  }, [clientesReceber]);

  const resumoReceber = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // KPIs alinhados à tabela visível (evita adiantamento gerado ≠ disponível / recebido).
    return clientesReceber.reduce(
      (acc, cliente) => {
        acc.aReceber += cliente.aReceber;
        acc.recebidas += cliente.recebido;
        acc.adiantamentos += cliente.adiantamentos;
        for (const l of cliente.lancamentos) {
          if (l.tipo !== "receita" || l.status === "pago" || l.status === "cancelado") {
            continue;
          }
          if (!isFaturaContasReceber(l)) continue;
          if (dateOnly(l.data) >= hoje) continue;
          acc.atraso += saldoFatura(l);
        }
        return acc;
      },
      { aReceber: 0, atraso: 0, recebidas: 0, adiantamentos: 0, naoFaturados: 0 }
    );
  }, [clientesReceber]);

  const trabalhosSelecionados = useMemo(
    () => trabalhos.filter((trabalho) => osSelecionadas.includes(trabalho.id)),
    [trabalhos, osSelecionadas]
  );
  const trabalhosNaoFaturadosAtivos = useMemo(
    () =>
      idsClientesAtivos.size === 0
        ? trabalhosNaoFaturados
        : trabalhosNaoFaturados.filter((trabalho) => {
            const clienteId = trabalho.cliente?.id;
            return !clienteId || idsClientesAtivos.has(clienteId);
          }),
    [trabalhosNaoFaturados, idsClientesAtivos]
  );
  const totalNaoFaturados = useMemo(
    () =>
      trabalhosNaoFaturadosAtivos.reduce((sum, trabalho) => sum + valorTrabalho(trabalho), 0),
    [trabalhosNaoFaturadosAtivos]
  );
  const valorOsSelecionadas = trabalhosSelecionados.reduce((sum, trabalho) => sum + valorTrabalho(trabalho), 0);
  const valorBruto = form.semOs ? parseDecimal(form.valor || "0") : valorOsSelecionadas;
  const descontoBase = parseDecimal(form.desconto || "0");
  const desconto =
    form.descontoTipo === "valor"
      ? descontoBase
      : valorBruto * (Math.min(Math.max(descontoBase, 0), 100) / 100);
  const jurosBase = parseDecimal(form.juros || "0");
  const jurosValor =
    form.jurosTipo === "valor"
      ? jurosBase
      : Math.max(valorBruto - desconto, 0) * (Math.max(jurosBase, 0) / 100);
  const totalLiquido = Math.max(0, valorBruto - desconto + jurosValor);

  function formaSelecionadaEhBoleto(parcelasLinha: ParcelaLinhaReceita[] = []) {
    const naParcela = parcelasLinha.some((p) =>
      (p.formaPagamento || "").toLowerCase().includes("boleto")
    );
    if (naParcela) return true;
    return (form.formaPagamento || "").toLowerCase().includes("boleto");
  }

  function formaSelecionadaEhPix(parcelasLinha: ParcelaLinhaReceita[] = []) {
    const naParcela = parcelasLinha.some((p) => formaEhPixAsaas(p.formaPagamento));
    if (naParcela) return true;
    return formaEhPixAsaas(form.formaPagamento);
  }

  function categoriaPadraoReceita() {
    const plano = carregarPlanoContas();
    return categoriaPadraoLancamento(plano, "receitas") || "Receitas de Serviços";
  }

  function descricaoReceitaComPlano(descricaoBase: string, anexos?: AnexoDespesa[]) {
    return empacotarDespesa(descricaoBase, {
      categoria: form.categoria || categoriaPadraoReceita(),
      conta: form.conta,
      parcela: form.parcela,
      ...(anexos?.length ? { anexos } : {}),
    });
  }

  function formaPagamentoValida(valor: string) {
    const v = valor?.trim();
    if (!v || v === "Forma Pagamento") {
      return pixAsaasDisponivel ? "Pix" : "Pix Externo";
    }
    return v;
  }

  function valorCampoMoedaPercentual(
    valor: string,
    tipo: "percentual" | "valor",
    base: number
  ) {
    const n = parseDecimal(valor || "0");
    return tipo === "percentual" ? (base * n) / 100 : n;
  }

  function valorParcelaNumerico(parcela: ParcelaLinhaReceita, baseParcela: number) {
    const valor = valorCampoMoedaPercentual(parcela.valor, parcela.valorTipo, baseParcela);
    const juros = valorCampoMoedaPercentual(
      parcela.juros,
      parcela.jurosTipo,
      Math.max(valor, 0)
    );
    return Math.max(0, valor + juros);
  }

  async function marcarOsFaturadasComoEntregues() {
    const hoje = brShortToIso(dateToBrShort(new Date()));
    const paraEntregar = trabalhosSelecionados.filter((t) => t.status === "finalizado");
    await Promise.all(
      paraEntregar.map((trabalho) =>
        fetch(`/api/trabalhos/${trabalho.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "entregue",
            dataEntrega: hoje,
          }),
        })
      )
    );
  }

  async function save({
    form,
    parcelas,
    imprimirRecibo,
    alterarEntregue,
    abaterCredito,
    enviarControleEntrega,
    anexos,
  }: LancarReceitaOsSubmit) {
    if (saveEmAndamentoRef.current) return;
    saveEmAndamentoRef.current = true;
    setSalvandoLancamento(true);
    try {
    setMensagemLancamento("");
    if (!form.clienteId?.trim()) {
      setMensagemLancamentoTipo("erro");
      setMensagemLancamento("Selecione o cliente para lançar a cobrança.");
      return;
    }
    if (form.semOs && parseDecimal(form.valor || "0") <= 0) {
      setMensagemLancamentoTipo("erro");
      setMensagemLancamento("Informe um valor maior que zero.");
      return;
    }
    if (!form.semOs && trabalhosSelecionados.length === 0) {
      setMensagemLancamentoTipo("erro");
      setMensagemLancamento("Selecione ao menos uma OS ou marque cobrança sem O.S.");
      return;
    }
    const creditoDisponivel = creditoDisponivelCliente(form.clienteId);
    const creditoAplicado =
      abaterCredito && creditoDisponivel > 0
        ? Math.min(creditoDisponivel, totalLiquido)
        : 0;
    const totalAReceberComCredito = Math.max(0, totalLiquido - creditoAplicado);
    const deveCriarFaturaReceber = Math.round(totalAReceberComCredito * 100) > 0;
    const descricaoBase = form.semOs
      ? `Cobrança sem O.S.${form.descricao?.trim() ? ` - ${form.descricao.trim()}` : ""}`
      : trabalhosSelecionados.length
        ? empacotarCobrancaOs(
            `Cobrança OS ${trabalhosSelecionados.map((trabalho) => trabalho.numeroOs).join(", ")}${
              form.descricao ? ` - ${form.descricao}` : ""
            }`,
            trabalhosSelecionados.map((trabalho) => trabalho.id)
          )
        : form.descricao || "Receita sem cobrança";
    const descricaoCobranca = descricaoReceitaComPlano(descricaoBase, anexos);
    const hojeIso = brShortToIso(dateToBrShort(new Date()));
    const lancamentosCriados: Lancamento[] = [];
    const algumRecebido = parcelas.some((p) => p.recebido);

    function valorParcelaFatura(parcela: ParcelaLinhaReceita, totalParcelas: number) {
      const qtd = Math.max(totalParcelas, 1);
      if (creditoAplicado <= 0.009) {
        return valorParcelaNumerico(parcela, totalLiquido / qtd);
      }
      const valorCobrancaParcela = valorParcelaNumerico(
        parcela,
        totalAReceberComCredito / qtd
      );
      if (totalAReceberComCredito <= 0.009) return 0;
      const proporcao = valorCobrancaParcela / totalAReceberComCredito;
      return Math.round(totalLiquido * proporcao * 100) / 100;
    }

    if (deveCriarFaturaReceber) {
      if (parcelas.length > 1) {
        const res = await fetch("/api/financeiro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "receita",
            clienteId: form.clienteId || undefined,
            descricao: descricaoCobranca,
            trabalhoId:
              form.semOs || trabalhosSelecionados.length !== 1
                ? undefined
                : trabalhosSelecionados[0].id,
            emitirBoleto: formaSelecionadaEhBoleto(parcelas) && !algumRecebido,
            emitirPix: formaSelecionadaEhPix(parcelas) && !algumRecebido,
            parcelas: parcelas.map((p) => ({
              valor: valorParcelaFatura(p, parcelas.length),
              data: p.recebido ? hojeIso : brShortToIso(p.vencimento || form.data),
              status: p.recebido ? "pago" : "pendente",
              formaPagamento: formaPagamentoValida(p.formaPagamento),
            })),
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMensagemLancamentoTipo("erro");
          setMensagemLancamento(
            typeof payload.error === "string"
              ? payload.error
              : "Não foi possível lançar a cobrança."
          );
          return;
        }
        if (Array.isArray(payload.lancamentos)) {
          lancamentosCriados.push(...payload.lancamentos);
        }
        const urlsBoleto = (Array.isArray(payload.lancamentos) ? payload.lancamentos : [])
          .flatMap((l: Lancamento) => {
            const url = l.cobrancaAsaas?.bankSlipUrl;
            return typeof url === "string" && url.length > 0 ? [url] : [];
          });
        if (urlsBoleto.length > 0) {
          setMensagemLancamentoTipo("sucesso");
          setMensagemLancamento(
            `${urlsBoleto.length} boleto(s) emitido(s) no Asaas. Abrindo PDFs…`
          );
          for (const url of urlsBoleto) {
            window.open(url, "_blank", "noopener,noreferrer");
          }
        } else if (
          Array.isArray(payload.avisosBoletos) &&
          payload.avisosBoletos.length > 0
        ) {
          setMensagemLancamentoTipo("erro");
          setMensagemLancamento(String(payload.avisosBoletos[0]));
          return;
        } else if (formaSelecionadaEhBoleto(parcelas) && !algumRecebido) {
          setMensagemLancamentoTipo("sucesso");
          setMensagemLancamento(
            payload.boletosEmitidos
              ? "Cobrança parcelada lançada com boletos emitidos."
              : "Cobrança parcelada lançada."
          );
        } else if (
          Array.isArray(payload.avisosPix) &&
          payload.avisosPix.length > 0
        ) {
          setMensagemLancamentoTipo("erro");
          setMensagemLancamento(String(payload.avisosPix[0]));
          return;
        } else if (payload.pixQr && formaSelecionadaEhPix(parcelas) && !algumRecebido) {
          const clienteNome =
            clientes.find((c) => c.id === form.clienteId)?.nome || "Cliente";
          setPixQrRecebimento({
            valor: totalAReceberComCredito,
            clienteNome,
            pixPayload: String(payload.pixQr.pixPayload || ""),
            pixEncodedImage: String(payload.pixQr.pixEncodedImage || ""),
            expirationDate:
              typeof payload.pixQr.expirationDate === "string"
                ? payload.pixQr.expirationDate
                : undefined,
          });
          setMensagemLancamentoTipo("sucesso");
          setMensagemLancamento("Cobrança parcelada lançada. Escaneie o QR Code Pix.");
        }
      } else {
        const p = parcelas[0];
        const valorLancamento = p
          ? valorParcelaFatura(p, 1)
          : creditoAplicado > 0.009
            ? totalLiquido
            : totalAReceberComCredito;
        const valorPixBoleto =
          creditoAplicado > 0.009
            ? p
              ? valorParcelaNumerico(p, totalAReceberComCredito)
              : totalAReceberComCredito
            : valorLancamento;
        const res = await fetch("/api/financeiro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "receita",
            clienteId: form.clienteId || undefined,
            valor: valorLancamento,
            data: p?.recebido ? hojeIso : brShortToIso(p?.vencimento || form.vencimento || form.data),
            formaPagamento: formaPagamentoValida(p?.formaPagamento || form.formaPagamento),
            status: p?.recebido ? "pago" : form.status || "pendente",
            trabalhoId:
              form.semOs || trabalhosSelecionados.length !== 1
                ? undefined
                : trabalhosSelecionados[0].id,
            descricao: descricaoCobranca,
            emitirBoleto: formaSelecionadaEhBoleto(parcelas) && !algumRecebido,
            emitirPix: formaSelecionadaEhPix(parcelas) && !algumRecebido,
            valorCobrancaAsaas: valorPixBoleto,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMensagemLancamentoTipo("erro");
          setMensagemLancamento(
            typeof payload.error === "string"
              ? payload.error
              : "Não foi possível lançar a cobrança."
          );
          return;
        }
        if (payload.id) lancamentosCriados.push(payload as Lancamento);
        if (payload.cobrancaAsaas?.bankSlipUrl) {
          setMensagemLancamentoTipo("sucesso");
          setMensagemLancamento("Boleto emitido no Asaas. Abrindo PDF…");
          window.open(payload.cobrancaAsaas.bankSlipUrl, "_blank", "noopener,noreferrer");
        } else if (payload.pixQr && formaSelecionadaEhPix(parcelas) && !algumRecebido) {
          const clienteNome =
            clientes.find((c) => c.id === form.clienteId)?.nome || "Cliente";
          setPixQrRecebimento({
            valor: valorPixBoleto,
            clienteNome,
            pixPayload: String(payload.pixQr.pixPayload || ""),
            pixEncodedImage: String(payload.pixQr.pixEncodedImage || ""),
            expirationDate:
              typeof payload.pixQr.expirationDate === "string"
                ? payload.pixQr.expirationDate
                : undefined,
          });
          setMensagemLancamentoTipo("sucesso");
          setMensagemLancamento("Pix gerado no Asaas. Escaneie o QR Code.");
        } else if (typeof payload.avisoBoleto === "string" && payload.avisoBoleto) {
          setMensagemLancamentoTipo("erro");
          setMensagemLancamento(payload.avisoBoleto);
          return;
        } else if (typeof payload.avisoPix === "string" && payload.avisoPix) {
          setMensagemLancamentoTipo("erro");
          setMensagemLancamento(payload.avisoPix);
          return;
        } else if (formaSelecionadaEhBoleto(parcelas) && !algumRecebido) {
          setMensagemLancamentoTipo("sucesso");
          setMensagemLancamento(
            payload.boletoEmitido
              ? "Cobrança lançada com boleto emitido."
              : "Cobrança lançada."
          );
        }
      }
    }
    if (creditoAplicado > 0) {
      await fetch("/api/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "receita",
          clienteId: form.clienteId || undefined,
          valor: creditoAplicado,
          data: brShortToIso(form.vencimento || form.data),
          status: "pago",
          formaPagamento: FORMA_PAGAMENTO_ABATIMENTO_CREDITO,
          descricao: `Desconto com crédito - ${descricaoCobranca}`,
        }),
      });
    }
    if (!mensagemLancamento || mensagemLancamentoTipo !== "erro") {
      if (
        alterarEntregue &&
        trabalhosSelecionados.length > 0 &&
        (deveCriarFaturaReceber || creditoAplicado > 0)
      ) {
        await marcarOsFaturadasComoEntregues();
      }
      if (enviarControleEntrega && trabalhosSelecionados.length > 0 && deveCriarFaturaReceber) {
        for (const trabalho of trabalhosSelecionados) {
          adicionarTrabalhoControleEntregasAutomatico(
            {
              id: trabalho.id,
              numeroOs: trabalho.numeroOs,
              tipoProtese: trabalho.tipoProtese,
              valor: valorTrabalho(trabalho),
              cliente: trabalho.cliente
                ? {
                    nome: trabalho.cliente.nome,
                    endereco: (trabalho.cliente as { endereco?: string | null }).endereco,
                    cidade: (trabalho.cliente as { cidade?: string | null }).cidade,
                    uf: (trabalho.cliente as { uf?: string | null }).uf,
                    cep: (trabalho.cliente as { cep?: string | null }).cep,
                    observacoes: (trabalho.cliente as { observacoes?: string | null })
                      .observacoes,
                  }
                : null,
            },
            { ignorarConfig: true }
          );
        }
      }
      const clienteNome =
        clientes.find((c) => c.id === form.clienteId)?.nome || "Cliente";
      if (imprimirRecibo && lancamentosCriados.length > 0) {
        abrirModalRecibo(clienteNome, lancamentosCriados);
      }
      setOpen(false);
      setMensagemLancamento("");
    }
    setForm({
      tipo: "receita",
      semOs: false,
      clienteId: "",
      convenio: "",
      categoria: categoriaPadraoReceita(),
      descricao: "",
      valor: "0,00",
      descontoTipo: "percentual",
      desconto: "0,00",
      jurosTipo: "percentual",
      juros: "0,00",
      acrescimo: false,
      data: dateToBrShort(new Date()),
      pedidoInicio: "",
      pedidoFinal: "",
      situacaoOs: "",
      vencimento: dateToBrShort(new Date()),
      status: "pendente",
      formaPagamento: "Forma Pagamento",
      conta: "Caixa Principal",
      parcela: "1/1",
      observacoes: "",
      recebido: false,
    });
    setOsSelecionadas([]);
    void loadPosMutacao();
    } finally {
      saveEmAndamentoRef.current = false;
      setSalvandoLancamento(false);
    }
  }

  async function marcarPago(id: string) {
    await fetch(`/api/financeiro/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pago" }),
    });
    void loadPosMutacao();
  }

  function saldosRestanteDoLancamento(lancamento: Lancamento) {
    const descricaoBase = lancamento.descricao.replace(/ - Saldo restante$/i, "").trim();
    const prefixoSaldo = `${descricaoBase} - Saldo restante`;
    return (data?.lancamentos || []).filter(
      (item) =>
        item.id !== lancamento.id &&
        item.tipo === "receita" &&
        item.status !== "pago" &&
        item.descricao.trim() === prefixoSaldo
    );
  }

  async function remove(id: string) {
    const lancamento = data?.lancamentos.find((item) => item.id === id);
    const lancamentos = data?.lancamentos || [];
    const numerosOs = lancamento ? numerosOsDoLancamento(lancamento) : [];
    const ehFaturaOs = lancamento && ehFaturaCobrancaOsParaExclusao(lancamento);
    const idsParaExcluir = lancamento
      ? ehFaturaOs
        ? idsLancamentosExclusaoAoRemoverFatura(
            lancamento as LancamentoContasReceber,
            lancamentos as LancamentoContasReceber[]
          )
        : Array.from(
            new Set([
              id,
              ...saldosRestanteDoLancamento(lancamento).map((item) => item.id),
              ...creditosUtilizadosDaFatura(lancamento).map((item) => item.id),
            ])
          )
      : [id];
    const parciaisVinculados =
      lancamento && ehFaturaOs
        ? recebimentosParciaisDaFatura(lancamento).length
        : 0;
    const avisos: string[] = [];
    if (numerosOs.length > 0 || lancamento?.trabalho?.numeroOs) {
      avisos.push(t("financeiro.receber.avisoOsNaoFaturadas"));
    }
    if (ehFaturaOs && (parciaisVinculados > 0 || creditosUtilizadosDaFatura(lancamento).length > 0)) {
      avisos.push(t("financeiro.receber.avisoRecebimentosVinculados"));
    }
    if (!ehFaturaOs && saldosRestanteDoLancamento(lancamento!).length) {
      avisos.push(
        t("financeiro.receber.avisoSaldoRestante", {
          qtd: String(saldosRestanteDoLancamento(lancamento!).length),
        })
      );
    }
    if (!ehFaturaOs && lancamento && creditosUtilizadosDaFatura(lancamento).length) {
      avisos.push(t("financeiro.receber.avisoCreditoAdiantamentos"));
    }
    setConfirmacaoExclusao({
      title: t("financeiro.receber.confirmExcluirTitulo"),
      message: t("financeiro.receber.confirmExcluirMensagem"),
      aviso: avisos.length > 0 ? avisos.join("\n\n") : undefined,
      onConfirm: async () => {
        const idsSet = new Set(idsParaExcluir);
        setData((prev) =>
          prev
            ? {
                ...prev,
                lancamentos: prev.lancamentos.filter((l) => !idsSet.has(l.id)),
              }
            : prev
        );
        setNotaCliente(null);
        setFaturaEditando(null);
        setDetalheRecebimento(null);
        setReciboRecebimento(null);
        setMovimentacoesRecebimento(null);
        setClienteCollapseAberto(null);
        if (ehFaturaOs) {
          await fetch(`/api/financeiro/${id}`, { method: "DELETE" });
        } else {
          await Promise.all(
            idsParaExcluir.map((lancamentoId) =>
              fetch(`/api/financeiro/${lancamentoId}`, { method: "DELETE" })
            )
          );
        }
        void loadPosMutacao();
      },
    });
  }

  async function estornarRecebimento(lancamento: Lancamento) {
    const exclusaoSomente =
      isCreditoUtilizado(lancamento) ||
      isCreditoGerado(lancamento) ||
      isRecebimentoParcial(lancamento);

    const ehCobrancaOs = ehDescricaoFaturaContasReceber(lancamento.descricao);
    // Só limpa lançamentos "Saldo restante" órfãos — abatimento de crédito e parciais ficam.
    const saldosRelacionados = ehCobrancaOs ? saldosRestanteDoLancamento(lancamento) : [];

    setConfirmacaoExclusao({
      title: t("financeiro.receber.confirmEstornarTitulo"),
      message: t("financeiro.receber.confirmEstornarMensagem"),
      onConfirm: async () => {
        if (exclusaoSomente) {
          await fetch(`/api/financeiro/${lancamento.id}`, { method: "DELETE" });
        } else if (ehCobrancaOs) {
          // Desfaz só o pagamento restante (reabre a fatura). Crédito/parciais permanecem.
          await fetch(`/api/financeiro/${lancamento.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "pendente" }),
          });
          await Promise.all(
            saldosRelacionados.map((item) =>
              fetch(`/api/financeiro/${item.id}`, { method: "DELETE" })
            )
          );
        } else {
          await fetch(`/api/financeiro/${lancamento.id}`, { method: "DELETE" });
        }

        setDetalheRecebimento(null);
        setReciboRecebimento(null);
        setClienteCollapseAberto(null);
        void loadPosMutacao();
      },
    });
  }

  function abrirEdicaoFatura(lancamento: Lancamento) {
    setFaturaEditando(lancamento);
    setOsRemovidasEdicao([]);
    setFormEdicaoFatura({
      descricao: complementoDescricaoCobranca(lancamento.descricao),
      data: dateToBrShort(new Date(lancamento.data)),
      valor: formatCurrencyInput(String(Math.round(lancamento.valor * 100))),
      formaPagamento: lancamento.formaPagamento || "Pix Externo",
      status: lancamento.status,
    });
  }

  async function salvarEdicaoFatura(e: React.FormEvent) {
    e.preventDefault();
    if (!faturaEditando) return;
    const trabalhosRelacionados = trabalhosDaFatura(faturaEditando).filter(
      (trabalho) => !osRemovidasEdicao.includes(trabalho.id)
    );
    const novoValor = parseMoney(formEdicaoFatura.valor);
    const valorAlterado = Math.abs(novoValor - faturaEditando.valor) > 0.009;
    await fetch(`/api/financeiro/${faturaEditando.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: descricaoCobrancaEditada(trabalhosRelacionados, formEdicaoFatura.descricao),
        data: brShortToIso(formEdicaoFatura.data),
        valor: novoValor,
        formaPagamento: formEdicaoFatura.formaPagamento,
        status: formEdicaoFatura.status,
        alterarValorOs: valorAlterado,
      }),
    });
    setFaturaEditando(null);
    setOsRemovidasEdicao([]);
    void loadPosMutacao();
  }

  function removerOsDaEdicao(trabalhoId: string) {
    setOsRemovidasEdicao((atuais) => {
      if (atuais.includes(trabalhoId)) return atuais;
      const atualizados = [...atuais, trabalhoId];
      if (faturaEditando) {
        const restantes = trabalhosDaFatura(faturaEditando).filter((trabalho) => !atualizados.includes(trabalho.id));
        const novoValor = restantes.reduce((sum, trabalho) => sum + valorTrabalho(trabalho), 0);
        setFormEdicaoFatura((current) => ({
          ...current,
          valor: formatCurrencyInput(String(Math.round(novoValor * 100))),
        }));
      }
      return atualizados;
    });
  }

  function receberCliente(cliente: ClienteReceber) {
    setRecebendoCliente(cliente);
  }

  async function confirmarRecebimento(
    payload: LancarRecebimentoConfirmacao,
    imprimir = false
  ) {
    if (!recebendoCliente) return;
    const selecionados = recebendoCliente.lancamentos.filter((l) =>
      payload.faturasSelecionadas.includes(l.id)
    );

    const valorDisponivel = payload.formas.reduce((sum, f) => sum + parseMoney(f.valor), 0);
    const formaComValor = payload.formas.find((f) => parseMoney(f.valor) > 0);
    const formaPrincipal = formaComValor?.forma ?? "Pix Externo";
    const contaRecebimento = formaComValor?.conta?.trim() || "Caixa Principal";
    const dataIso = brShortToIso(payload.dataRecebimento);
    const faturasPagas: Lancamento[] = [];

    if (formaEhPixAsaas(formaPrincipal) && valorDisponivel > 0.009) {
      if (!recebendoCliente.clienteId) {
        alert("Selecione um cliente cadastrado para gerar Pix com QR Code.");
        return;
      }

      let creditoRestante = payload.abaterCredito
        ? creditoDisponivelCliente(recebendoCliente.clienteId)
        : 0;

      if (selecionados.length > 0) {
        for (const l of selecionados) {
          const juros = payload.jurosPorFatura[l.id] ?? 0;
          let devido = saldoFatura(l) + juros;
          const creditoAplicado =
            creditoRestante > 0.009 ? Math.min(creditoRestante, devido) : 0;

          if (creditoAplicado > 0.009) {
            await fetch("/api/financeiro", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tipo: "receita",
                clienteId: recebendoCliente.clienteId || undefined,
                valor: creditoAplicado,
                data: dataIso,
                status: "pago",
                formaPagamento: FORMA_PAGAMENTO_ABATIMENTO_CREDITO,
                descricao: empacotarReceitaConta(
                  `Desconto com crédito - ${l.descricao}`,
                  contaRecebimento
                ),
              }),
            });
            creditoRestante -= creditoAplicado;
            devido -= creditoAplicado;
          }

          if (devido <= 0.009) {
            await fetch(`/api/financeiro/${l.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                valor: l.valor,
                status: "pago",
                formaPagamento: FORMA_PAGAMENTO_ABATIMENTO_CREDITO,
                data: dataIso,
                descricao: empacotarReceitaConta(l.descricao, contaRecebimento),
              }),
            });
          }
        }
      }

      const resPix = await fetch("/api/asaas/pix-cobranca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lancamentoIds:
            selecionados.length > 0 ? selecionados.map((l) => l.id) : undefined,
          valor: valorDisponivel,
          clienteId: recebendoCliente.clienteId,
          conta: contaRecebimento,
          dataRecebimento: dataIso,
          descricao:
            selecionados.length === 0
              ? "Adiantamento / Crédito cliente"
              : selecionados.length === 1
                ? selecionados[0].descricao
                : `Recebimento Pix — ${selecionados.length} fatura(s)`,
        }),
      });
      const pixResposta = await resPix.json().catch(() => ({}));
      if (!resPix.ok) {
        alert(
          typeof pixResposta.error === "string"
            ? pixResposta.error
            : "Falha ao gerar Pix com QR Code."
        );
        void loadPosMutacao();
        return;
      }

      setPixQrRecebimento({
        valor: valorDisponivel,
        clienteNome: recebendoCliente.nome,
        pixPayload: String(pixResposta.pixPayload || ""),
        pixEncodedImage: String(pixResposta.pixEncodedImage || ""),
        expirationDate:
          typeof pixResposta.expirationDate === "string"
            ? pixResposta.expirationDate
            : undefined,
      });
      setRecebendoCliente(null);
      void loadPosMutacao();
      return;
    }

    if (selecionados.length === 0) {
      if (valorDisponivel <= 0.009) return;

      const resAdiantamento = await fetch("/api/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "receita",
          clienteId: recebendoCliente.clienteId || undefined,
          valor: valorDisponivel,
          data: dataIso,
          status: "pago",
          formaPagamento: formaPrincipal,
          descricao: empacotarReceitaConta(
            "Adiantamento / Crédito cliente",
            contaRecebimento
          ),
        }),
      });
      const adiantamentoPayload = await resAdiantamento.json().catch(() => ({}));
      if (adiantamentoPayload?.id) {
        faturasPagas.push(adiantamentoPayload as Lancamento);
      } else {
        faturasPagas.push({
          id: `credito-${Date.now()}`,
          tipo: "receita",
          descricao: "Adiantamento / Crédito cliente",
          valor: valorDisponivel,
          data: dataIso,
          status: "pago",
          formaPagamento: formaPrincipal,
          cliente: recebendoCliente.clienteId
            ? { id: recebendoCliente.clienteId, nome: recebendoCliente.nome }
            : null,
        });
      }

      if (imprimir) {
        abrirModalRecibo(recebendoCliente.nome, faturasPagas);
      }
      setRecebendoCliente(null);
      void loadPosMutacao();
      return;
    }

    let creditoRestante = payload.abaterCredito
      ? creditoDisponivelCliente(recebendoCliente.clienteId)
      : 0;
    let valorRestante = valorDisponivel;

    for (const l of selecionados) {
      const juros = payload.jurosPorFatura[l.id] ?? 0;
      let devido = saldoFatura(l) + juros;

      const creditoAplicado =
        creditoRestante > 0.009 ? Math.min(creditoRestante, devido) : 0;

      if (creditoAplicado > 0.009) {
        const resCredito = await fetch("/api/financeiro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "receita",
            clienteId: recebendoCliente.clienteId || undefined,
            valor: creditoAplicado,
            data: dataIso,
            status: "pago",
            formaPagamento: FORMA_PAGAMENTO_ABATIMENTO_CREDITO,
            descricao: empacotarReceitaConta(
              `Desconto com crédito - ${l.descricao}`,
              contaRecebimento
            ),
          }),
        });
        const creditoPayload = await resCredito.json().catch(() => ({}));
        if (creditoPayload?.id) {
          faturasPagas.push(creditoPayload as Lancamento);
        } else {
          faturasPagas.push({
            id: `credito-uso-${Date.now()}`,
            tipo: "receita",
            descricao: `Desconto com crédito - ${l.descricao}`,
            valor: creditoAplicado,
            data: dataIso,
            status: "pago",
            formaPagamento: FORMA_PAGAMENTO_ABATIMENTO_CREDITO,
            cliente: recebendoCliente.clienteId
              ? { id: recebendoCliente.clienteId, nome: recebendoCliente.nome }
              : null,
          });
        }
        creditoRestante -= creditoAplicado;
        devido -= creditoAplicado;
      }

      if (devido <= 0.009) {
        await fetch(`/api/financeiro/${l.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            valor: l.valor,
            status: "pago",
            formaPagamento: FORMA_PAGAMENTO_ABATIMENTO_CREDITO,
            data: dataIso,
            descricao: empacotarReceitaConta(l.descricao, contaRecebimento),
          }),
        });
        faturasPagas.push({
          ...l,
          valor: l.valor,
          status: "pago",
          formaPagamento: FORMA_PAGAMENTO_ABATIMENTO_CREDITO,
          data: dataIso,
        });
        continue;
      }

      if (valorRestante <= 0) continue;

      const valorPago = Math.min(valorRestante, devido);

      if (valorPago >= devido - 0.009) {
        await fetch(`/api/financeiro/${l.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            valor: l.valor,
            status: "pago",
            formaPagamento: formaPrincipal,
            data: dataIso,
            descricao: empacotarReceitaConta(l.descricao, contaRecebimento),
          }),
        });
        faturasPagas.push({
          ...l,
          valor: l.valor,
          status: "pago",
          formaPagamento: formaPrincipal,
          data: dataIso,
        });
      } else {
        const resParcial = await fetch("/api/financeiro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "receita",
            clienteId: recebendoCliente.clienteId || undefined,
            valor: valorPago,
            data: dataIso,
            status: "pago",
            formaPagamento: formaPrincipal,
            descricao: empacotarReceitaConta(
              `Recebimento parcial - ${l.descricao}`,
              contaRecebimento
            ),
            trabalhoId: l.trabalho?.id,
          }),
        });
        const parcialPayload = await resParcial.json().catch(() => ({}));
        if (parcialPayload?.id) {
          faturasPagas.push(parcialPayload as Lancamento);
        } else {
          faturasPagas.push({
            id: `parcial-${Date.now()}`,
            tipo: "receita",
            descricao: `Recebimento parcial - ${l.descricao}`,
            valor: valorPago,
            data: dataIso,
            status: "pago",
            formaPagamento: formaPrincipal,
            cliente: recebendoCliente.clienteId
              ? { id: recebendoCliente.clienteId, nome: recebendoCliente.nome }
              : null,
          });
        }

        const totalRecebidoFatura =
          recebidoNaFatura(l) + creditoAplicado + valorPago;
        if (totalRecebidoFatura >= l.valor - 0.009) {
          await fetch(`/api/financeiro/${l.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              valor: l.valor,
              status: "pago",
              formaPagamento: formaPrincipal,
              data: dataIso,
              descricao: empacotarReceitaConta(l.descricao, contaRecebimento),
            }),
          });
        }
      }

      valorRestante -= valorPago;
    }

    if (valorRestante > 0.009) {
      await fetch("/api/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "receita",
          clienteId: recebendoCliente.clienteId || undefined,
          valor: valorRestante,
          data: dataIso,
          status: "pago",
          formaPagamento: formaPrincipal,
          descricao: empacotarReceitaConta(
            "Adiantamento / Crédito cliente",
            contaRecebimento
          ),
        }),
      });
      faturasPagas.push({
        id: `credito-${Date.now()}`,
        tipo: "receita",
        descricao: "Adiantamento / Crédito cliente",
        valor: valorRestante,
        data: dataIso,
        status: "pago",
        formaPagamento: formaPrincipal,
        cliente: recebendoCliente.clienteId
          ? { id: recebendoCliente.clienteId, nome: recebendoCliente.nome }
          : null,
      });
    }

    if (imprimir) {
      abrirModalRecibo(recebendoCliente.nome, faturasPagas);
    }
    setRecebendoCliente(null);
    void loadPosMutacao();
  }

  function numeroFatura(lancamento: Lancamento) {
    const receitas = (data?.lancamentos || [])
      .filter((item) => item.tipo === "receita")
      .slice()
      .reverse();
    return receitas.findIndex((item) => item.id === lancamento.id) + 1 || 1;
  }

  function clienteKey(cliente: ClienteReceber) {
    return cliente.clienteId || cliente.nome;
  }

  function isCreditoGerado(lancamento: Lancamento) {
    const descricao = lancamento.descricao.toLowerCase();
    return descricao.startsWith("adiantamento") || descricao.includes("crédito cliente");
  }

  function isCreditoUtilizado(lancamento: Lancamento) {
    const descricao = lancamento.descricao.toLowerCase();
    return descricao.startsWith("crédito utilizado") || descricao.includes("desconto com crédito");
  }

  function referenciaLancamento(lancamento: Lancamento) {
    return referenciaHistoricoRecebimento(lancamento, data?.lancamentos || []);
  }

  function formaPagamentoExibicao(lancamento: Lancamento) {
    if (isCreditoUtilizado(lancamento)) return FORMA_PAGAMENTO_ABATIMENTO_CREDITO;
    return lancamento.formaPagamento || "-";
  }

  function podeReabrirPixAsaas(lancamento: Lancamento) {
    if (!pixAsaasDisponivel) return false;
    if (!formaEhPixAsaas(lancamento.formaPagamento)) return false;
    if (lancamento.status === "pago") return false;
    return true;
  }

  async function abrirPixQrLancamento(lancamento: Lancamento, clienteNome: string) {
    if (pixAbrindoLancamentoId) return;
    setPixAbrindoLancamentoId(lancamento.id);
    try {
      const res = await fetch(
        `/api/asaas/pix-cobranca?lancamentoId=${encodeURIComponent(lancamento.id)}`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        pixPayload?: string;
        pixEncodedImage?: string;
        expirationDate?: string;
      };
      if (!res.ok) {
        alert(
          typeof json.error === "string"
            ? json.error
            : t("financeiro.receber.erroPixQr")
        );
        return;
      }
      setPixQrRecebimento({
        valor: lancamento.valor,
        clienteNome,
        pixPayload: String(json.pixPayload || ""),
        pixEncodedImage: String(json.pixEncodedImage || ""),
        expirationDate:
          typeof json.expirationDate === "string" ? json.expirationDate : undefined,
      });
    } finally {
      setPixAbrindoLancamentoId(null);
    }
  }

  function isFaturaContasReceber(lancamento: Lancamento) {
    if (isCreditoGerado(lancamento) || isCreditoUtilizado(lancamento)) return false;
    if (!ehDescricaoFaturaContasReceber(lancamento.descricao)) return false;
    if (lancamento.formaPagamento?.toLowerCase().includes("crédito")) return false;
    const creditoQuitouFatura =
      creditoUsadoNaFatura(lancamento) > 0 &&
      Math.round(saldoFatura(lancamento) * 100) <= 0;
    return !creditoQuitouFatura;
  }

  function creditoDisponivelCliente(clienteId?: string) {
    return calcularCreditoDisponivelClienteFatura(data?.lancamentos ?? [], clienteId);
  }

  function recebimentosDoCliente(clienteId?: string): Lancamento[] {
    if (!clienteId) return [];
    const lancamentos = data?.lancamentos || [];
    return recebimentosHistoricoCliente(clienteId, lancamentos) as Lancamento[];
  }

  function faturasPainelCliente(clienteId?: string): Lancamento[] {
    if (!clienteId) return [];
    const lancamentos = data?.lancamentos || [];
    const inicio = dataInicio ? parseBrShortDate(dataInicio) : null;
    const fim = dataFinal ? parseBrShortDate(dataFinal) : null;
    if (inicio) inicio.setHours(0, 0, 0, 0);
    if (fim) fim.setHours(23, 59, 59, 999);
    return faturasExibicaoPainelCliente(clienteId, lancamentos, {
      inicio,
      fim,
      situacao,
    }) as Lancamento[];
  }

  function faturasPendentesCliente(clienteId?: string) {
    if (!clienteId) return [];
    return (data?.lancamentos || []).filter(
      (lancamento) =>
        lancamento.status !== "pago" &&
        isFaturaContasReceber(lancamento) &&
        lancamento.cliente?.id === clienteId
    );
  }

  function creditoUsadoNaFatura(lancamento: Lancamento) {
    return creditosUtilizadosDaFatura(lancamento)
      .reduce((sum, item) => sum + item.valor, 0);
  }

  function creditosUtilizadosDaFatura(lancamento: Lancamento) {
    const descricaoFatura = descricaoReceitaSemMeta(lancamento.descricao).trim();
    const prefixos = [
      `Desconto com crédito - ${descricaoFatura}`,
      `Crédito utilizado - ${descricaoFatura}`,
    ];
    return (data?.lancamentos || []).filter((item) => {
      if (!isCreditoUtilizado(item) || item.cliente?.id !== lancamento.cliente?.id) {
        return false;
      }
      const base = descricaoReceitaSemMeta(item.descricao).trim();
      return (
        prefixos.includes(base) ||
        base.endsWith(` - ${descricaoFatura}`) ||
        base.includes(descricaoFatura)
      );
    });
  }

  function recebimentosParciaisDaFatura(lancamento: Lancamento) {
    const descricaoBase = descricaoReceitaSemMeta(lancamento.descricao).trim();
    const prefixo = `Recebimento parcial - ${descricaoBase}`;
    return (data?.lancamentos || []).filter((item) => {
      if (item.tipo !== "receita" || item.status !== "pago") return false;
      if (item.cliente?.id !== lancamento.cliente?.id) return false;
      return descricaoReceitaSemMeta(item.descricao).trim() === prefixo;
    });
  }

  function recebidoNaFatura(lancamento: Lancamento) {
    return recebidoNaFaturaLib(lancamento, data?.lancamentos || []);
  }

  function saldoFatura(lancamento: Lancamento) {
    return saldoFaturaLib(lancamento, data?.lancamentos || []);
  }

  function clienteTemVencido(cliente: ClienteReceber) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return cliente.lancamentos.some(
      (lancamento) =>
        isFaturaContasReceber(lancamento) &&
        lancamento.status !== "pago" &&
        dateOnly(lancamento.data) < hoje
    );
  }

  function clienteTemAVencer(cliente: ClienteReceber) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return cliente.lancamentos.some(
      (lancamento) =>
        isFaturaContasReceber(lancamento) &&
        lancamento.status !== "pago" &&
        dateOnly(lancamento.data) >= hoje
    );
  }

  function situacaoFatura(lancamento: Lancamento): {
    key: SituacaoFaturaKey;
    color: string;
  } {
    if (lancamento.status === "cancelado") {
      return {
        key: "financeiro.receber.situacao.cancelado",
        color: "bg-slate-100 text-slate-600",
      };
    }
    const quitada = faturaQuitada(lancamento, data?.lancamentos || []);
    if (quitada) {
      return {
        key: "financeiro.receber.situacao.recebido",
        color: "bg-emerald-100 text-emerald-800 font-semibold",
      };
    }
    if (faturaExibeSituacaoParcial(lancamento, data?.lancamentos || [])) {
      return {
        key: "financeiro.receber.situacao.parcial",
        color: "bg-amber-100 text-amber-800",
      };
    }
    if (lancamento.status === "pago") {
      return {
        key: "financeiro.receber.situacao.recebido",
        color: "bg-emerald-100 text-emerald-700",
      };
    }
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = dateOnly(lancamento.data);
    return vencimento < hoje
      ? {
          key: "financeiro.receber.situacao.vencido",
          color: "bg-[#dc2626] text-white font-semibold",
        }
      : {
          key: "financeiro.receber.situacao.emDia",
          color: "bg-emerald-100 text-emerald-700",
        };
  }

  function situacaoFaturaLabel(lancamento: Lancamento) {
    const situacao = situacaoFatura(lancamento);
    const aReceber = lancamento.status !== "pago" && saldoFatura(lancamento) > 0.009;
    const vencido =
      aReceber && situacao.key === "financeiro.receber.situacao.vencido";
    return {
      label: vencido
        ? t("financeiro.receber.situacao.vencidoUpper")
        : aReceber
          ? t("financeiro.receber.situacao.aReceberUpper")
          : t(situacao.key).toUpperCase(),
      aReceber: aReceber && !vencido,
      vencido,
    };
  }

  function abrirClienteModal(cliente: ClienteReceber) {
    setDetalheCliente(cliente);
  }

  function abrirImprimirFatura(cliente: ClienteReceber, lancamento: Lancamento) {
    setFaturaImprimindo({ cliente, lancamento });
  }

  function faturaHtml(cliente: ClienteReceber, lancamentoUnico?: Lancamento) {
    const lancamentos = lancamentoUnico
      ? [lancamentoUnico]
      : cliente.lancamentos.filter((l) => l.tipo === "receita");
    const primeiraFatura = lancamentos[0];
    const credito = primeiraFatura ? creditoUsadoNaFatura(primeiraFatura) : 0;
    let totalServicos = 0;
    let totalLiquidoItens = 0;
    const linhas = lancamentos
      .flatMap((l) => {
        const trabalhosRelacionados = trabalhosDaFatura(l, cliente.clienteId);
        if (!trabalhosRelacionados.length) {
          const os = l.trabalho?.numeroOs || "-";
          totalServicos += l.valor;
          totalLiquidoItens += l.valor;
          return [`<tr><td>${os}</td><td>${descricaoExibicaoCobranca(l.descricao)}</td><td>-</td><td>-</td><td class="center">1</td><td class="right">${money(l.valor)}</td><td class="right">% 0.00</td><td class="right">${money(l.valor)}</td></tr>`];
        }
        return trabalhosRelacionados.flatMap((trabalho) => {
          return itensNotaFromTrabalho(trabalho).map((item) => {
            totalLiquidoItens += item.subtotal;
            // Unitário na tabela legado já vem líquido; Desconto mostra o % da OS.
            totalServicos += item.subtotal;
            const data = trabalho.dataPrevista ? formatDate(trabalho.dataPrevista) : formatDate(l.data);
            const descTexto = (item.descPercent || "0,00").trim();
            const descFmt =
              descTexto.startsWith("%") || descTexto.startsWith("R$")
                ? descTexto
                : `% ${descTexto.replace("%", "").replace(",", ".").trim() || "0.00"}`;
            return `<tr>
            <td>${trabalho.numeroOs}<br/><span>Data: ${data}</span></td>
            <td>${item.servico}</td>
            <td>${item.dentes}</td>
            <td>${trabalho.paciente?.nome || "-"}</td>
            <td class="center">${item.quantidade}</td>
            <td class="right">${money(item.valorUn)}</td>
            <td class="right">${descFmt}</td>
            <td class="right">${money(item.subtotal)}</td>
          </tr>`;
          });
        });
      })
      .join("");
    const valorNota = primeiraFatura?.valor ?? totalLiquidoItens;
    const descontoFaturaExtra = Math.max(
      0,
      Math.round((totalLiquidoItens - valorNota) * 100) / 100
    );
    const totalFinal = Math.max(valorNota - credito, 0);
    const descontoFaturaExibir = credito + descontoFaturaExtra;
    const lab = labImpressaoFromConfig();
    const cabecalhoLab = htmlCabecalhoLab(lab);
    return `<!doctype html><html><head><title>Fatura</title><style>
      @page{size:A4;margin:0}
      *{box-sizing:border-box}
      html,body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111;font-size:9px;margin:0;padding:0}
      .page{width:210mm;min-height:297mm;margin:0 auto;padding:12mm 14mm}
      .actions{text-align:right;margin-bottom:8px}
      .header{display:grid;grid-template-columns:118px 1fr 150px;gap:18px;align-items:center;margin:20px 0 22px}
      .header:not(:has(.logo)){grid-template-columns:1fr 150px}
      .logo{display:flex;align-items:center;justify-content:flex-start;min-width:91px}
      .lab{line-height:1.05}.lab strong{display:block;font-size:18px;margin-bottom:4px}.lab span{font-size:14px}
      .invoice{text-align:center;font-size:22px;line-height:1.05}.invoice strong{display:block;font-size:24px;margin-top:4px}.invoice span{display:block;margin-top:12px;font-size:8px}
      .rule{border-top:2px solid #111;margin:0 0 8px}
      .info{display:grid;grid-template-columns:1fr 1fr;gap:6px;border-bottom:1px solid #777;padding-bottom:4px;margin-bottom:4px;line-height:1.35}
      table{width:100%;border-collapse:collapse}.items th,.items td{border-bottom:1px solid #777;padding:3px 4px;vertical-align:top}
      .items th{font-size:8px;font-weight:bold;text-align:left}.items td span{font-size:8px}
      .right{text-align:right}.center{text-align:center}.totals{width:270px;margin-left:auto;margin-top:4px;border-top:1px solid #777}
      .totals div{display:grid;grid-template-columns:1fr 86px;padding:2px 0}.totals strong{font-weight:bold}
      .payment{margin-top:18px;border-top:1px solid #777;padding-top:8px}.payment-title{font-weight:bold;margin-bottom:6px}
      .payment table th,.payment table td{padding:4px 6px;text-align:left}.obs{margin-top:14px;border-top:1px solid #ddd;padding-top:8px}
      @media print{body{padding:0;margin:0}.actions{display:none}.page{width:210mm;min-height:297mm;padding:12mm 14mm}}
    </style></head><body>
      <div class="page">
        <div class="actions"><button onclick="window.print()">Imprimir</button></div>
        <div class="header">
          ${cabecalhoLab}
          <div class="invoice">
            Fatura
            <strong>${primeiraFatura ? numeroFatura(primeiraFatura) : "-"}</strong>
            <span>Data: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
        <div class="rule"></div>
        <div class="info">
          <div>
            <strong>Cliente:</strong> ${cliente.nome}<br/>
            <strong>Telefones:</strong><br/>
            <strong>Saldo Anterior:</strong> 0,00
          </div>
          <div>
            <strong>Email:</strong><br/>
            <strong>Endereço:</strong>
          </div>
        </div>
        <table class="items">
          <thead><tr><th>Os</th><th>Serviço/Produtos</th><th>Número Dente</th><th>Paciente</th><th class="center">Qtd</th><th class="right">Unitário</th><th class="right">Desc</th><th class="right">Subtotal</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
        <div class="totals">
          <div><span>Total Serviços / Produtos (=)</span><strong class="right">R$ ${money(totalServicos)}</strong></div>
          <div><span>Desconto Serviços (-)</span><span class="right">R$ 0,00</span></div>
          <div><span>Desconto Fatura (-)</span><span class="right">R$ ${money(descontoFaturaExibir)}</span></div>
          <div><span>Juros Fatura (+)</span><span class="right">R$ 0,00</span></div>
          <div><strong>Total (=)</strong><strong class="right">R$ ${money(totalFinal)}</strong></div>
        </div>
        <div class="payment">
          <div class="payment-title">Condição de Pagamento</div>
          <table>
            <thead><tr><th>Parcela</th><th>Vencimento</th><th>Forma Pgto</th><th>Valor</th><th>Pago</th></tr></thead>
            <tbody><tr><td>1 / 1</td><td>${primeiraFatura ? formatDate(primeiraFatura.data) : "-"}</td><td>${primeiraFatura?.formaPagamento || "-"}</td><td>${money(totalFinal)}</td><td>${primeiraFatura?.status === "pago" ? money(totalFinal) : "0,00"}</td></tr></tbody>
          </table>
        </div>
        <div class="obs">Observação:</div>
      </div>
    </body></html>`;
  }

  async function imprimirNota(cliente: ClienteReceber) {
    const receitas = cliente.lancamentos.filter((l) => l.tipo === "receita");
    const total = receitas.reduce((s, l) => s + l.valor, 0);
    const janela = prepararAbaPdf();
    try {
      const blob = await gerarRelatorioTabelaPdf({
        tituloRelatorio: "Nota de Cobrança",
        colunas: [
          { titulo: "Descrição", larguraMm: 110, alinhamento: "left" },
          { titulo: "Valor", larguraMm: 66, alinhamento: "right" },
        ],
        linhas: receitas.map((l) => [descricaoExibicaoCobranca(l.descricao), currency(l.valor)]),
        linhaTotal: {
          indiceRotulo: 0,
          rotulo: "TOTAL",
          celulas: ["TOTAL", currency(total)],
        },
      });
      abrirPdfNoVisualizador(blob, "nota-cobranca.pdf", undefined, janela);
    } catch (err) {
      if (janela && !janela.closed) janela.close();
      console.error("gerar PDF nota", err);
      alert("Não foi possível gerar o PDF da nota.");
    }
  }

  function linhasReciboDeLancamentos(lancamentos: Lancamento[]): LinhaReciboRecebimento[] {
    const todos = data?.lancamentos || [];
    return lancamentos.map((l) => ({
      valor: Math.abs(
        valorHistoricoRecebimentoCliente(l, todos as LancamentoContasReceber[])
      ),
      data: l.data,
      formaPagamento: formaPagamentoExibicao(l),
      referencia: referenciaLancamento(l),
      descricao: l.descricao,
      numeroFatura: numeroFatura(l),
    }));
  }

  function abrirModalRecibo(clienteNome: string, lancamentos: Lancamento[]) {
    if (lancamentos.length === 0) return;
    setReciboRecebimento({
      clienteNome,
      linhas: linhasReciboDeLancamentos(lancamentos),
    });
  }

  function imprimirRecibo(lancamento: Lancamento, cliente: ClienteReceber) {
    abrirModalRecibo(cliente.nome, [lancamento]);
  }

  function limparFiltros() {
    setPeriodo("todos");
    setDataInicio("");
    setDataFinal("");
    setSituacao("");
    setBusca("");
  }

  const linhasContasReceberTela = useMemo(
    () =>
      clientesReceber.map((cliente) => ({
        nome: cliente.nome,
        aReceber: cliente.aReceber,
        recebido: cliente.recebido,
        adiantamentos: cliente.adiantamentos,
        naoFaturados: cliente.naoFaturados,
      })),
    [clientesReceber]
  );

  async function imprimirContasReceberTela() {
    const janela = prepararAbaPdf();
    if (!janela) return;

    setExportandoContasReceberTela(true);
    try {
      const blob = await gerarContasReceberClientesPdf(
        linhasContasReceberTela,
        dataInicio,
        dataFinal,
        { locale }
      );
      abrirPdfNoVisualizador(
        blob,
        "contas-a-receber.pdf",
        t("financeiro.receber.secaoContasReceber"),
        janela
      );
    } catch (err) {
      console.error("imprimir contas a receber", err);
      janela.close();
      alert(t("financeiro.receber.relatorio.erroPdfPopup"));
    } finally {
      setExportandoContasReceberTela(false);
    }
  }

  function exportarContasReceberTela() {
    exportarContasReceberClientesCsv(linhasContasReceberTela, { locale });
  }

  function toggleOsReceita(id: string) {
    setOsSelecionadas((atuais) => {
      if (atuais.includes(id)) {
        return atuais.filter((item) => item !== id);
      }

      const trabalho = trabalhos.find((item) => item.id === id);
      const novos = [...atuais, id];
      if (!trabalho) return novos;

      for (const vinculado of segmentosCobraveisVinculados(trabalho)) {
        if (!novos.includes(vinculado.id)) novos.push(vinculado.id);
      }
      return novos;
    });
  }

  function toggleSelecionarTodasReceita() {
    if (todasReceitaSelecionadas) {
      setOsSelecionadas((atuais) =>
        atuais.filter((id) => !idsReceitaVisiveis.includes(id))
      );
    } else {
      setOsSelecionadas(idsReceitaVisiveis);
    }
  }

  function aplicarPeriodo(value: string) {
    setPeriodo(value);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (value === "todos" || value === "outro") {
      if (value === "todos") {
        setDataInicio("");
        setDataFinal("");
      }
      return;
    }

    const inicio = new Date(hoje);
    const fim = new Date(hoje);

    if (value === "semana") {
      const dia = hoje.getDay();
      inicio.setDate(hoje.getDate() - dia);
      fim.setDate(inicio.getDate() + 6);
    }

    if (value === "mes") {
      inicio.setDate(1);
      fim.setMonth(hoje.getMonth() + 1, 0);
    }

    if (value === "proximos30") {
      fim.setDate(hoje.getDate() + 30);
    }

    setDataInicio(dateToBrShort(inicio));
    setDataFinal(dateToBrShort(fim));
  }

  if (!data) return <p>{t("common.carregando")}</p>;

  return (
    <div className="space-y-3 text-[11px] text-slate-700">
      <div
        className={cn(
          "grid gap-3",
          trabalhosNaoFaturadosAtivos.length > 0 ? "md:grid-cols-4" : "md:grid-cols-3"
        )}
      >
        <div className="rounded border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-800">{money(resumoReceber.aReceber)}</p>
              <p className="text-[11px] text-slate-500">
                {t("financeiro.receber.resumoAdiantamentosAReceber", {
                  adiantamentos: money(resumoReceber.adiantamentos),
                  aReceber: money(resumoReceber.aReceber),
                })}
              </p>
            </div>
            <span className="rounded-full bg-orange-50 p-2 text-orange-400">
              <FileText className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-800">{money(resumoReceber.atraso)}</p>
              <p className="text-[11px] text-slate-500">{t("financeiro.receber.resumoAtraso")}</p>
            </div>
            <span className="rounded-full bg-rose-50 p-2 text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-800">{money(resumoReceber.recebidas)}</p>
              <p className="text-[11px] text-slate-500">{t("financeiro.receber.resumoRecebidas")}</p>
            </div>
            <span className="rounded-full bg-emerald-50 p-2 text-emerald-500">
              <Check className="h-4 w-4" />
            </span>
          </div>
        </div>
        {trabalhosNaoFaturadosAtivos.length > 0 ? (
          <div className="rounded border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-800">
                  {money(totalNaoFaturados)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t("financeiro.receber.naoFaturados")}{" "}
                  <button
                    type="button"
                    onClick={() => setModalNaoFaturados(true)}
                    className="rounded bg-[#4a90d9] px-1.5 py-0.5 text-[9px] font-normal text-white hover:bg-[#3b7bc4]"
                  >
                    {t("common.ver")}
                  </button>
                </p>
              </div>
              <span className="rounded-full bg-amber-50 p-2 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          {t("financeiro.receber.lancarReceita")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="bg-primary-600 text-white hover:bg-primary-700"
          onClick={() => setRelatorioAberto(true)}
        >
          <FileText className="h-3.5 w-3.5" />
          {t("financeiro.receber.relatorios")}
        </Button>
        <BotoesImprimirExportarToolbar
          onImprimir={() => void imprimirContasReceberTela()}
          onExportarExcel={exportarContasReceberTela}
          processando={exportandoContasReceberTela}
        />
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_1.4fr_auto]">
          <Select label={t("financeiro.pagar.filtro.periodo")} value={periodo} onChange={(e) => aplicarPeriodo(e.target.value)}>
            <option value="hoje">{t("financeiro.pagar.filtro.hoje")}</option>
            <option value="semana">{t("financeiro.pagar.filtro.semana")}</option>
            <option value="mes">{t("financeiro.pagar.filtro.mes")}</option>
            <option value="proximos30">{t("financeiro.receber.filtro.proximos30")}</option>
            <option value="todos">{t("financeiro.pagar.filtro.mostrarTodos")}</option>
            <option value="outro">{t("financeiro.pagar.filtro.outroPeriodo")}</option>
            <option value="outro">{t("financeiro.receber.filtro.dataInicioFinal")}</option>
          </Select>
          <CampoDataBr
            label={t("financeiro.boletos.dataInicio")}
            value={dataInicio}
            onChange={setDataInicio}
            onValueChange={() => setPeriodo("outro")}
          />
          <CampoDataBr
            label={t("financeiro.boletos.dataFim")}
            value={dataFinal}
            onChange={setDataFinal}
            onValueChange={() => setPeriodo("outro")}
          />
          <Select label={t("financeiro.receber.filtro.situacao")} value={situacao} onChange={(e) => setSituacao(e.target.value)}>
            <option value="">{t("financeiro.receber.filtro.mostrarTodos")}</option>
            <option value="receber">{t("financeiro.receber.filtro.aReceber")}</option>
            <option value="atraso">{t("financeiro.receber.filtro.emAtraso")}</option>
          </Select>
          <Input
            label={t("common.procurar")}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("common.procurar")}
          />
          <Button className="mt-6" size="sm" variant="secondary" onClick={limparFiltros}>
            {t("common.limpar")}
          </Button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left font-semibold uppercase">{t("financeiro.pagar.col.nome")}</th>
                <th className="px-3 py-2 text-right font-semibold uppercase">{t("financeiro.receber.col.aReceber")}</th>
                <th className="px-3 py-2 text-right font-semibold uppercase">{t("financeiro.receber.col.recebido")}</th>
                <th className="px-3 py-2 text-right font-semibold uppercase">{t("financeiro.receber.col.adiantamentos")}</th>
                <th className="px-3 py-2 text-right font-semibold uppercase">{t("financeiro.receber.col.naoFaturados")}</th>
                <th className="px-3 py-2 text-center font-semibold uppercase">{t("common.opcoes")}</th>
              </tr>
            </thead>
            <tbody>
              {clientesReceber.map((cliente) => {
                const chave = clienteKey(cliente);
                const aberto = clienteCollapseAberto === chave;
                const faturasContasReceber = faturasPainelCliente(cliente.clienteId);
                const temFatura = faturasContasReceber.length > 0;
                const recebimentosCliente = recebimentosDoCliente(cliente.clienteId);

                return (
                  <Fragment key={chave}>
                    <tr
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirClienteModal(cliente)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          abrirClienteModal(cliente);
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-b border-slate-100",
                        aberto && temFatura
                          ? "bg-blue-50/70"
                          : temFatura && clienteTemVencido(cliente)
                            ? "bg-red-100/70"
                            : temFatura && clienteTemAVencer(cliente)
                              ? "bg-emerald-100/70"
                              : "hover:bg-slate-50"
                      )}
                    >
                      <td className="px-3 py-2">{cliente.nome}</td>
                      <td className="px-3 py-2 text-right">{money(cliente.aReceber)}</td>
                      <td className="px-3 py-2 text-right">{money(cliente.recebido)}</td>
                      <td className="px-3 py-2 text-right">{money(cliente.adiantamentos)}</td>
                      <td className="px-3 py-2 text-right">{money(cliente.naoFaturados)}</td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => receberCliente(cliente)}
                            className="rounded bg-primary-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-primary-700"
                          >
                            {t("financeiro.receber.receber")}
                          </button>
                          <button
                            type="button"
                            title={t("financeiro.receber.visualizarFaturas")}
                            onClick={() => setClienteCollapseAberto(aberto ? null : chave)}
                            className={cn(
                              "rounded p-1 hover:bg-slate-100 hover:text-primary-700",
                              aberto ? "bg-primary-50 text-primary-700" : "text-slate-500"
                            )}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {aberto && (
                      <tr
                        className={cn(
                          "border-b",
                          temFatura ? "border-blue-100 bg-blue-50/40" : "border-slate-100 bg-white"
                        )}
                      >
                        <td colSpan={6} className="px-3 py-3">
                          <div className="space-y-4">
                            <div className="rounded border border-blue-200 bg-white p-3 shadow-sm">
                              <div className="mb-3 flex items-center gap-2 text-primary-700">
                                <FileText className="h-3.5 w-3.5" />
                                <strong>{t("financeiro.receber.secaoContasReceber")}</strong>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[850px] text-[11px]">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                      <th className="px-2 py-2 text-left">{t("financeiro.pagar.col.vencimento")}</th>
                                      <th className="px-2 py-2 text-left">{t("financeiro.receber.col.numeroFatura")}</th>
                                      <th className="px-2 py-2 text-left">{t("financeiro.receber.col.parcela")}</th>
                                      <th className="px-2 py-2 text-left">{t("financeiro.receber.col.formaRecebimento")}</th>
                                      <th className="px-2 py-2 text-right">{t("financeiro.pagar.col.valor")}</th>
                                      <th className="px-2 py-2 text-right">{t("financeiro.receber.col.recebido")}</th>
                                      <th className="px-2 py-2 text-right">{t("financeiro.receber.col.saldo")}</th>
                                      <th className="px-2 py-2 text-left">{t("financeiro.receber.filtro.situacao")}</th>
                                      <th className="px-2 py-2 text-center">{t("common.opcoes")}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {faturasContasReceber.length === 0 && (
                                      <tr>
                                        <td colSpan={9} className="px-2 py-8 text-center text-slate-400">
                                          {t("financeiro.receber.vazioFaturas")}
                                        </td>
                                      </tr>
                                    )}
                                    {faturasContasReceber.map((l) => {
                                      const situacao = situacaoFatura(l);
                                      const quitada = faturaQuitada(l, data?.lancamentos || []);
                                      return (
                                        <tr key={l.id} className="border-b border-slate-100">
                                          <td className="px-2 py-2">{formatDate(l.data)}</td>
                                          <td className="px-2 py-2">{numeroFatura(l)}</td>
                                          <td className="px-2 py-2">1 / 1</td>
                                          <td className="px-2 py-2">{l.formaPagamento || "-"}</td>
                                          <td className="px-2 py-2 text-right">{money(l.valor)}</td>
                                          <td className="px-2 py-2 text-right">
                                            {money(recebidoNaFatura(l))}
                                          </td>
                                          <td className="px-2 py-2 text-right">{money(saldoFatura(l))}</td>
                                          <td className="px-2 py-2">
                                            <span className={`rounded px-2 py-1 ${situacao.color}`}>
                                              {t(situacao.key)}
                                            </span>
                                          </td>
                                          <td className="px-2 py-2">
                                            <div className="flex items-center justify-center gap-1">
                                              {podeReabrirPixAsaas(l) ? (
                                                <button
                                                  type="button"
                                                  title={t("financeiro.receber.abrirPixQr")}
                                                  disabled={pixAbrindoLancamentoId === l.id}
                                                  onClick={() =>
                                                    void abrirPixQrLancamento(l, cliente.nome)
                                                  }
                                                  className="inline-flex items-center gap-1 rounded p-1 text-sky-600 hover:bg-sky-50 disabled:opacity-50"
                                                >
                                                  <QrCode className="h-3.5 w-3.5" />
                                                  <span className="text-[10px]">{t("financeiro.receber.pix")}</span>
                                                </button>
                                              ) : null}
                                              {l.cobrancaAsaas?.bankSlipUrl ? (
                                                <a
                                                  href={l.cobrancaAsaas.bankSlipUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  title={t("financeiro.receber.abrirBoletoPdf")}
                                                  className="inline-flex items-center gap-1 rounded p-1 text-emerald-600 hover:bg-emerald-50"
                                                >
                                                  <FileText className="h-3.5 w-3.5" />
                                                  <span className="text-[10px]">{t("financeiro.receber.boleto")}</span>
                                                </a>
                                              ) : null}
                                              {quitada ? (
                                                <button
                                                  type="button"
                                                  title={t("financeiro.receber.verMovimentacoes")}
                                                  onClick={() =>
                                                    setMovimentacoesRecebimento({
                                                      cliente,
                                                      fatura: l,
                                                    })
                                                  }
                                                  className="rounded p-1 text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                                                >
                                                  <ListTree className="h-3.5 w-3.5" />
                                                </button>
                                              ) : null}
                                              <button
                                                type="button"
                                                title={t("financeiro.receber.imprimirNota")}
                                                onClick={() => abrirImprimirFatura(cliente, l)}
                                                className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                                              >
                                                <Printer className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                title={t("financeiro.receber.editarFatura")}
                                                onClick={() => abrirEdicaoFatura(l)}
                                                className="rounded p-1 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                title={t("financeiro.receber.excluirFatura")}
                                                onClick={() => remove(l.id)}
                                                className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div className="rounded border border-emerald-200 bg-white p-3 shadow-sm">
                              <div className="mb-3 flex items-center gap-2 text-emerald-700">
                                <Check className="h-3.5 w-3.5" />
                                <strong>{t("financeiro.receber.secaoRecebimentos")}</strong>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] text-[11px]">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                      <th className="px-2 py-2 text-left">{t("financeiro.receber.col.data")}</th>
                                      <th className="px-2 py-2 text-left">{t("financeiro.receber.col.formaPagamento")}</th>
                                      <th className="px-2 py-2 text-left">{t("financeiro.receber.col.referencia")}</th>
                                      <th className="px-2 py-2 text-right">{t("financeiro.pagar.col.valor")}</th>
                                      <th className="px-2 py-2 text-center">{t("common.opcoes")}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {recebimentosCliente.length === 0 && (
                                      <tr>
                                        <td colSpan={5} className="px-2 py-8 text-center text-slate-400">
                                          {t("financeiro.receber.vazioRecebimentos")}
                                        </td>
                                      </tr>
                                    )}
                                    {recebimentosCliente.map((l) => (
                                      <tr key={`recebimento-${l.id}`} className="border-b border-slate-100">
                                        <td className="px-2 py-2">{formatDate(l.data)}</td>
                                        <td className="px-2 py-2">
                                          <span
                                            className={
                                              isCreditoUtilizado(l)
                                                ? "rounded bg-red-100 px-2 py-1 text-red-700"
                                                : "rounded bg-cyan-50 px-2 py-1 text-cyan-700"
                                            }
                                          >
                                            {formaPagamentoExibicao(l)}
                                          </span>
                                        </td>
                                        <td className="px-2 py-2">
                                          <span
                                            className={classeReferenciaHistoricoRecebimento(
                                              l,
                                              data?.lancamentos || []
                                            )}
                                          >
                                            {referenciaLancamento(l)}
                                          </span>
                                        </td>
                                        <td
                                          className={cn(
                                            "px-2 py-2 text-right",
                                            isCreditoUtilizado(l) && "font-medium text-red-600"
                                          )}
                                        >
                                          {money(
                                            valorHistoricoRecebimentoCliente(
                                              l,
                                              data?.lancamentos || []
                                            )
                                          )}
                                        </td>
                                        <td className="px-2 py-2">
                                          <div className="flex items-center justify-center gap-1">
                                            {podeReabrirPixAsaas(l) ? (
                                              <button
                                                type="button"
                                                title={t("financeiro.receber.abrirPixQr")}
                                                disabled={pixAbrindoLancamentoId === l.id}
                                                onClick={() =>
                                                  void abrirPixQrLancamento(l, cliente.nome)
                                                }
                                                className="inline-flex items-center gap-1 rounded p-1 text-sky-600 hover:bg-sky-50 disabled:opacity-50"
                                              >
                                                <QrCode className="h-3.5 w-3.5" />
                                                <span className="text-[10px]">{t("financeiro.receber.pix")}</span>
                                              </button>
                                            ) : null}
                                            {l.cobrancaAsaas?.bankSlipUrl ? (
                                              <a
                                                href={l.cobrancaAsaas.bankSlipUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={t("financeiro.receber.abrirBoletoPdf")}
                                                className="inline-flex items-center gap-1 rounded p-1 text-emerald-600 hover:bg-emerald-50"
                                              >
                                                <FileText className="h-3.5 w-3.5" />
                                                <span className="text-[10px]">{t("financeiro.receber.boleto")}</span>
                                              </a>
                                            ) : null}
                                            <button
                                              type="button"
                                              title={t("financeiro.receber.estornarRecebimento")}
                                              onClick={() => void estornarRecebimento(l)}
                                              className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              title={t("financeiro.receber.imprimirRecibo")}
                                              onClick={() => imprimirRecibo(l, cliente)}
                                              className="inline-flex items-center gap-1 rounded p-1 text-emerald-600 hover:bg-emerald-50"
                                            >
                                              <Printer className="h-3.5 w-3.5" />
                                              <span className="text-[10px]">{t("financeiro.receber.recibo")}</span>
                                            </button>
                                            <button
                                              type="button"
                                              title={t("financeiro.receber.detalheRecebimento")}
                                              onClick={() =>
                                                setDetalheRecebimento({ cliente, lancamento: l })
                                              }
                                              className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                                            >
                                              <Eye className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {clientesReceber.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    {t("financeiro.receber.vazioClientes")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmacaoExclusao ? (
        <Suspense fallback={null}>
          <ConfirmacaoExclusaoModalLazy
            open
            titulo={confirmacaoExclusao.title}
            mensagem={confirmacaoExclusao.message}
            aviso={confirmacaoExclusao.aviso}
            detalhe={confirmacaoExclusao.detalhe}
            tipoConfirmacao={confirmacaoExclusao.tipoConfirmacao}
            onClose={() => setConfirmacaoExclusao(null)}
            onConfirm={() => {
              void confirmacaoExclusao.onConfirm();
            }}
          />
        </Suspense>
      ) : null}

      {recebendoCliente ? (
        <Suspense fallback={null}>
          <LancarRecebimentoModalLazy
            open
            onClose={() => setRecebendoCliente(null)}
            clienteNome={recebendoCliente.nome}
            totalDevido={faturasPendentesCliente(recebendoCliente.clienteId).reduce(
              (sum, l) => sum + saldoFatura(l),
              0
            )}
            faturas={faturasPendentesCliente(recebendoCliente.clienteId)}
            numeroFatura={numeroFatura}
            saldoFatura={saldoFatura}
            formatDate={formatDate}
            money={money}
            parseMoney={parseMoney}
            formatCurrencyInput={formatCurrencyInput}
            onConfirmar={(payload, imprimir) => void confirmarRecebimento(payload, imprimir)}
            creditoDisponivel={creditoDisponivelCliente(recebendoCliente.clienteId)}
            onVisualizar={(lancamento) => {
              setItensFatura(lancamento as Lancamento);
            }}
            pixAsaasDisponivel={pixAsaasDisponivel}
          />
        </Suspense>
      ) : null}

      {detalheCliente ? (
        <Suspense fallback={null}>
          <VisualizacaoClienteReceberModalLazy
            open
            onClose={() => setDetalheCliente(null)}
            cliente={detalheCliente}
        clientes={clientesReceber}
        clienteTelefone={
          detalheCliente
            ? clientes.find(
                (c) =>
                  c.id === detalheCliente.clienteId ||
                  c.nome.trim().toLowerCase() === detalheCliente.nome.trim().toLowerCase()
              )?.celular
            : undefined
        }
        trabalhos={trabalhos.map((t) => ({
          id: t.id,
          numeroOs: t.numeroOs,
          status: t.status,
          paciente: t.paciente?.nome ?? null,
          tipoProtese: t.tipoProtese,
          valor: t.valor,
          dentes: t.dentes,
          cor: t.cor,
          instrucoes: t.instrucoes,
          dataEntrega: t.dataEntrega ?? null,
          dataPrevista: t.dataPrevista ?? null,
          cliente: t.cliente
            ? { id: t.cliente.id, nome: t.cliente.nome, cro: t.cliente.cro }
            : null,
        }))}
        filtrosPainel={{ dataInicio, dataFinal, situacao }}
        onRecarregarDados={loadPosMutacao}
        onClienteChange={(cliente) => setDetalheCliente(cliente as ClienteReceber)}
        money={money}
        formatDate={formatDate}
        numeroFatura={(l) => numeroFatura(l as Lancamento)}
        saldoFatura={(l) => saldoFatura(l as Lancamento)}
        recebidoNaFatura={(l) => recebidoNaFatura(l as Lancamento)}
        isFaturaContasReceber={(l) => isFaturaContasReceber(l as Lancamento)}
        referenciaLancamento={(l) => referenciaLancamento(l as Lancamento)}
        situacaoFaturaLabel={(l) => situacaoFaturaLabel(l as Lancamento)}
        onReceber={() => {
          if (!detalheCliente) return;
          const cliente = detalheCliente;
          setDetalheCliente(null);
          receberCliente(cliente);
        }}
        onReceberFatura={() => {
          if (!detalheCliente) return;
          const cliente = detalheCliente;
          setDetalheCliente(null);
          receberCliente(cliente);
        }}
        onImprimirNota={() => {
          if (!detalheCliente) return;
          const faturas = detalheCliente.lancamentos.filter(isFaturaContasReceber);
          void imprimirNota({ ...detalheCliente, lancamentos: faturas });
        }}
        onVisualizarFatura={(l) => {
          setItensFatura(l as Lancamento);
        }}
        onImprimirFatura={(l) => {
          if (!detalheCliente) return;
          abrirImprimirFatura(detalheCliente, l as Lancamento);
        }}
        onEditarFatura={(l) => abrirEdicaoFatura(l as Lancamento)}
        onExcluirFatura={(l) => remove(l.id)}
        onEstornarRecebimento={(l) => void estornarRecebimento(l as Lancamento)}
        onImprimirRecibo={(l) => {
          if (!detalheCliente) return;
          imprimirRecibo(l as Lancamento, detalheCliente);
        }}
        onDetalheRecebimento={(l) => {
          if (!detalheCliente) return;
          setDetalheRecebimento({ cliente: detalheCliente, lancamento: l as Lancamento });
        }}
          />
        </Suspense>
      ) : null}

      <Modal
        open={Boolean(faturaEditando)}
        onClose={() => setFaturaEditando(null)}
        title={t("financeiro.receber.editarReceita")}
        size="xl"
      >
        {faturaEditando && (() => {
          const trabalhosRelacionados = trabalhosDaFatura(faturaEditando).filter(
            (trabalho) => !osRemovidasEdicao.includes(trabalho.id)
          );
          const valorTotal = trabalhosRelacionados.length
            ? trabalhosRelacionados.reduce((sum, trabalho) => sum + valorTrabalho(trabalho), 0)
            : parseMoney(formEdicaoFatura.valor);
          const valorLiquido = parseMoney(formEdicaoFatura.valor) || valorTotal;
          const clienteNome = faturaEditando.cliente?.nome || trabalhosRelacionados[0]?.cliente?.nome || "-";

          return (
            <form onSubmit={salvarEdicaoFatura} className="space-y-4 text-[10px] text-slate-600">
              <div className="grid gap-3 md:grid-cols-[0.8fr_1.4fr_1fr]">
                <Input
                  label="Data do Lançamento"
                  value={formEdicaoFatura.data}
                  onChange={(e) =>
                    setFormEdicaoFatura((current) => ({
                      ...current,
                      data: formatDateInput(e.target.value),
                    }))
                  }
                  className="h-8 rounded border-slate-300 text-[11px]"
                  placeholder="dd/mm/aaaa"
                />
                <Input
                  label="Descrição"
                  value={formEdicaoFatura.descricao}
                  onChange={(e) =>
                    setFormEdicaoFatura((current) => ({
                      ...current,
                      descricao: e.target.value,
                    }))
                  }
                  className="h-8 rounded border-slate-300 text-[11px]"
                />
                <Select label="Categoria" value="Receitas de Serviços" onChange={() => undefined} className="h-8 rounded border-slate-300 text-[11px]">
                  <option>Receitas de Serviços</option>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-slate-500">Adicionar Cobrança</p>
                <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                  <table className="w-full min-w-[1020px] text-[9px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-[#f4f3fb] uppercase text-slate-500">
                        <th className="px-2 py-2 text-center">Selecionado</th>
                        <th className="px-2 py-2 text-left">OS</th>
                        <th className="px-2 py-2 text-left">Data Entregue</th>
                        <th className="px-2 py-2 text-center">Qtd</th>
                        <th className="px-2 py-2 text-left">Serviço/Produto</th>
                        <th className="px-2 py-2 text-left">Cliente</th>
                        <th className="px-2 py-2 text-left">Dentista</th>
                        <th className="px-2 py-2 text-left">Paciente</th>
                        <th className="px-2 py-2 text-right">Valor</th>
                        <th className="px-2 py-2 text-center">Situação</th>
                        <th className="px-2 py-2 text-center">Opções</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trabalhosRelacionados.length === 0 && (
                        <tr className="border-b border-slate-100">
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" checked readOnly className="h-3 w-3 accent-primary-600" />
                          </td>
                          <td className="px-2 py-2">{numeroFatura(faturaEditando)}</td>
                          <td className="px-2 py-2">{formatDate(faturaEditando.data)}</td>
                          <td className="px-2 py-2 text-center">1</td>
                          <td className="px-2 py-2">{descricaoExibicaoCobranca(faturaEditando.descricao)}</td>
                          <td className="px-2 py-2">{clienteNome}</td>
                          <td className="px-2 py-2">-</td>
                          <td className="px-2 py-2">-</td>
                          <td className="px-2 py-2 text-right">{money(parseMoney(formEdicaoFatura.valor))}</td>
                          <td className="px-2 py-2 text-center">
                            <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700">Finalizado</span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setFormEdicaoFatura((current) => ({
                                  ...current,
                                  valor: formatCurrencyInput("0"),
                                  descricao: "",
                                }))
                              }
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      )}
                      {trabalhosRelacionados.map((trabalho) => {
                        const status = STATUS_TRABALHO[trabalho.status] || STATUS_TRABALHO.pendente;
                        return (
                          <tr key={trabalho.id} className="border-b border-slate-100">
                            <td className="px-2 py-2 text-center">
                              <input type="checkbox" checked readOnly className="h-3 w-3 accent-primary-600" />
                            </td>
                            <td className="px-2 py-2">{trabalho.numeroOs}</td>
                            <td className="px-2 py-2">{formatDate(trabalho.dataPrevista)}</td>
                            <td className="px-2 py-2 text-center">1</td>
                            <td className="px-2 py-2">{trabalho.tipoProtese}</td>
                            <td className="px-2 py-2">{trabalho.cliente?.nome || clienteNome}</td>
                            <td className="px-2 py-2">{trabalho.cliente?.nome || "-"}</td>
                            <td className="px-2 py-2">{trabalho.paciente?.nome || "-"}</td>
                            <td className="px-2 py-2 text-right">{money(valorTrabalho(trabalho))}</td>
                            <td className="px-2 py-2 text-center">
                              <span className={`rounded px-2 py-0.5 ${status.color}`}>{status.label}</span>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removerOsDaEdicao(trabalho.id)}
                                className="text-red-400 hover:text-red-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="ml-auto grid max-w-md gap-3 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span>Valor Total</span>
                    <strong>{money(valorTotal)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Desconto</span>
                    <div className="flex h-8 w-40 overflow-hidden rounded border border-slate-200 bg-slate-50">
                      <span className="flex w-10 items-center justify-center border-r border-slate-200 text-slate-400">%</span>
                      <input value="0,00" readOnly className="w-full bg-slate-50 px-2 text-right outline-none" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-primary-700">
                    <span>Valor Líquido</span>
                    <strong>{money(valorLiquido)}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded border border-blue-200 p-3">
                <p className="mb-3 text-center text-slate-500">Escolha a forma de recebimento</p>
                <div className="mb-3 max-w-xs">
                  <Select label="Parcela" value="1" onChange={() => undefined} className="h-8 rounded border-slate-300 text-[11px]">
                    <option value="1">1</option>
                  </Select>
                </div>
                <div className="grid gap-2 md:grid-cols-[0.5fr_1.1fr_1fr_1fr_1fr_0.8fr_0.8fr]">
                  <Input label="Parcela" value="1 / 1" readOnly className="h-8 rounded border-slate-300 bg-slate-50 text-[11px]" />
                  <Select
                    label="Forma Recebimento"
                    value={formEdicaoFatura.formaPagamento}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (
                        !pixAsaasDisponivel &&
                        (next.trim().toLowerCase() === "pix" ||
                          next.toLowerCase().includes("boleto"))
                      ) {
                        return;
                      }
                      setFormEdicaoFatura((current) => ({
                        ...current,
                        formaPagamento: next,
                      }));
                    }}
                    className="h-8 rounded border-slate-300 text-[11px]"
                    title={
                      pixAsaasDisponivel
                        ? undefined
                        : "Pix e Boleto liberam após criar a conta digital Asaas."
                    }
                  >
                    <option>Pix Externo</option>
                    <option>Dinheiro</option>
                    <option>Cartão</option>
                    <option disabled={!pixAsaasDisponivel} style={!pixAsaasDisponivel ? { color: "#c0c4cc" } : undefined}>
                      {pixAsaasDisponivel ? "Pix" : "Pix (conta digital)"}
                    </option>
                    <option disabled={!pixAsaasDisponivel} style={!pixAsaasDisponivel ? { color: "#c0c4cc" } : undefined}>
                      {pixAsaasDisponivel ? "Boleto" : "Boleto (conta digital)"}
                    </option>
                  </Select>
                  <Select label="Conta" value="Caixa Principal" onChange={() => undefined} className="h-8 rounded border-slate-300 text-[11px]">
                    <option>Caixa Principal</option>
                    <option>Banco</option>
                  </Select>
                  <Input
                    label="Vencimento"
                    value={formEdicaoFatura.data}
                    onChange={(e) =>
                      setFormEdicaoFatura((current) => ({
                        ...current,
                        data: formatDateInput(e.target.value),
                      }))
                    }
                    className="h-8 rounded border-slate-300 text-[11px]"
                  />
                  <Input
                    label="Valor"
                    selectOnFocus
                    value={formEdicaoFatura.valor}
                    onChange={(e) =>
                      setFormEdicaoFatura((current) => ({
                        ...current,
                        valor: formatCurrencyInput(e.target.value),
                      }))
                    }
                    className="h-8 rounded border-slate-300 text-[11px]"
                  />
                  <Input label="Juros" value="0,00" readOnly className="h-8 rounded border-slate-300 bg-slate-50 text-[11px]" />
                  <Select
                    label="Situação"
                    value={formEdicaoFatura.status}
                    onChange={(e) =>
                      setFormEdicaoFatura((current) => ({
                        ...current,
                        status: e.target.value,
                      }))
                    }
                    className="h-8 rounded border-slate-300 text-[11px]"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Recebido</option>
                    <option value="cancelado">Cancelado</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-600">Observações</label>
                <textarea className="min-h-[58px] w-full rounded border border-slate-300 px-3 py-2 text-[11px] outline-none focus:border-primary-500" />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Button type="submit" className="rounded bg-blue-600 hover:bg-blue-700">
                  Confirmar Edição
                </Button>
                <Button type="button" variant="outline" className="rounded" onClick={() => setFaturaEditando(null)}>
                  Fechar
                </Button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {movimentacoesRecebimento ? (
        <MovimentacoesRecebimentoModal
          open
          onClose={() => setMovimentacoesRecebimento(null)}
          clienteNome={movimentacoesRecebimento.cliente.nome}
          numeroFatura={numeroFatura(movimentacoesRecebimento.fatura)}
          movimentacoes={movimentacoesRecebimentoDaFatura(
            movimentacoesRecebimento.fatura,
            data?.lancamentos || []
          )}
          lancamentos={data?.lancamentos || []}
          money={money}
          formatDate={formatDate}
          formaPagamentoExibicao={(l) => formaPagamentoExibicao(l as Lancamento)}
        />
      ) : null}

      <Modal
        open={Boolean(detalheRecebimento)}
        onClose={() => setDetalheRecebimento(null)}
        title={t("financeiro.receber.detalhesRecebimento")}
        size="xl"
      >
        {detalheRecebimento && (
          <div className="space-y-5 text-[13px] text-slate-600">
            <div className="space-y-1">
              <p>
                <strong>{t("financeiro.receber.dataRecebimento")}</strong>{" "}
                {formatDate(detalheRecebimento.lancamento.data)}
              </p>
              <p>
                <strong>{t("financeiro.receber.forma")}</strong>{" "}
                <span className="rounded bg-cyan-50 px-2 py-0.5 text-xs font-bold text-cyan-700">
                  {detalheRecebimento.lancamento.formaPagamento || "Pix Externo"}
                </span>
              </p>
              <p>
                <strong>{t("financeiro.receber.valorRecebido")}</strong>{" "}
                {currency(detalheRecebimento.lancamento.valor)}
              </p>
              <p>
                <strong>{t("financeiro.receber.observacao")}</strong>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-slate-500">
                    <th className="px-3 py-3 text-left font-bold uppercase">{t("financeiro.receber.col.numeroFatura")}</th>
                    <th className="px-3 py-3 text-left font-bold uppercase">{t("financeiro.receber.col.parcela")}</th>
                    <th className="px-3 py-3 text-left font-bold uppercase">{t("financeiro.pagar.col.vencimento")}</th>
                    <th className="px-3 py-3 text-left font-bold uppercase">{t("financeiro.pagar.col.valor")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50">
                    <td className="px-3 py-3">
                      <span className="rounded bg-blue-100 px-2 py-1 font-semibold text-blue-700">
                        {numeroFatura(detalheRecebimento.lancamento)}
                      </span>
                    </td>
                    <td className="px-3 py-3">1 / 1</td>
                    <td className="px-3 py-3">{formatDate(detalheRecebimento.lancamento.data)}</td>
                    <td className="px-3 py-3">{money(detalheRecebimento.lancamento.valor)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {podeReabrirPixAsaas(detalheRecebimento.lancamento) ? (
                <Button
                  type="button"
                  className="bg-sky-600 text-white hover:bg-sky-700"
                  disabled={pixAbrindoLancamentoId === detalheRecebimento.lancamento.id}
                  onClick={() =>
                    void abrirPixQrLancamento(
                      detalheRecebimento.lancamento,
                      detalheRecebimento.cliente.nome
                    )
                  }
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  {t("financeiro.receber.verQrCodePix")}
                </Button>
              ) : null}
              {detalheRecebimento.lancamento.cobrancaAsaas?.bankSlipUrl ? (
                <a
                  href={detalheRecebimento.lancamento.cobrancaAsaas.bankSlipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {t("financeiro.receber.abrirBoleto")}
                </a>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setDetalheRecebimento(null)}
              >
                × {t("financeiro.receber.fechar")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {reciboRecebimento ? (
        <Suspense fallback={null}>
          <ImprimirReciboModalLazy
            open
            onClose={() => setReciboRecebimento(null)}
            clienteNome={reciboRecebimento.clienteNome}
            linhas={reciboRecebimento.linhas}
          />
        </Suspense>
      ) : null}

      {itensFatura ? (
        <Suspense fallback={null}>
          <ItensFaturaModalLazy
            open
            onClose={() => setItensFatura(null)}
            linhas={linhasItensFaturaFromTrabalhos(trabalhosDaFatura(itensFatura), formatDate)}
          />
        </Suspense>
      ) : null}

      {faturaImprimindo ? (
        <Suspense fallback={null}>
          <ImprimirFaturaModalLazy
            open
            onClose={() => setFaturaImprimindo(null)}
            numeroFatura={numeroFatura(faturaImprimindo.lancamento)}
            clienteNome={faturaImprimindo.cliente.nome}
            clienteTelefone={clientes.find(
              (c) =>
                c.id ===
                (faturaImprimindo.cliente.clienteId ||
                  faturaImprimindo.lancamento.cliente?.id)
            )?.celular}
            valorFatura={faturaImprimindo.lancamento.valor}
            montarDados={(_opcoes, _configFaturas) => {
              const lancamento = faturaImprimindo.lancamento;
              const clienteId =
                faturaImprimindo.cliente.clienteId || lancamento.cliente?.id;
              const lancamentosCliente = data?.lancamentos || [];
              const creditoUsado = creditoUsadoNaFatura(lancamento);
              const creditoDisponivel = calcularCreditoDisponivelClienteFatura(
                lancamentosCliente,
                clienteId
              );
              return montarDadosFaturaImpressao({
                numeroFatura: numeroFatura(lancamento),
                clienteNome: faturaImprimindo.cliente.nome,
                lancamento,
                trabalhos: trabalhosDaFatura(
                  lancamento,
                  faturaImprimindo.cliente.clienteId
                ),
                creditoFatura: creditoUsado,
                valorRecebido: recebidoNaFatura(lancamento),
                clienteId,
                lancamentosCliente: lancamentosCliente,
                ultimoPgto: calcularUltimoPagamentoClienteFatura({
                  lancamentos: lancamentosCliente,
                  clienteId,
                  excluirLancamentoId:
                    lancamento.status !== "pago" ? lancamento.id : undefined,
                  formatDate,
                  money,
                }),
                saldoAnterior: calcularSaldoAnteriorFatura({
                  creditoDisponivel,
                  creditoUsadoNaFaturaAtual: creditoUsado,
                  lancamentos: lancamentosCliente,
                  clienteId,
                  excluirLancamentoId: lancamento.id,
                  money,
                }),
                formatDate,
                money,
              });
            }}
            gerarHtml={(opcoes, configFaturas) => {
              const lancamento = faturaImprimindo.lancamento;
              const clienteId =
                faturaImprimindo.cliente.clienteId || lancamento.cliente?.id;
              const lancamentosCliente = data?.lancamentos || [];
              const creditoUsado = creditoUsadoNaFatura(lancamento);
              const creditoDisponivel = calcularCreditoDisponivelClienteFatura(
                lancamentosCliente,
                clienteId
              );
              const dados = montarDadosFaturaImpressao({
                numeroFatura: numeroFatura(lancamento),
                clienteNome: faturaImprimindo.cliente.nome,
                lancamento,
                trabalhos: trabalhosDaFatura(
                  lancamento,
                  faturaImprimindo.cliente.clienteId
                ),
                creditoFatura: creditoUsado,
                valorRecebido: recebidoNaFatura(lancamento),
                clienteId,
                lancamentosCliente: lancamentosCliente,
                ultimoPgto: calcularUltimoPagamentoClienteFatura({
                  lancamentos: lancamentosCliente,
                  clienteId,
                  excluirLancamentoId:
                    lancamento.status !== "pago" ? lancamento.id : undefined,
                  formatDate,
                  money,
                }),
                saldoAnterior: calcularSaldoAnteriorFatura({
                  creditoDisponivel,
                  creditoUsadoNaFaturaAtual: creditoUsado,
                  lancamentos: lancamentosCliente,
                  clienteId,
                  excluirLancamentoId: lancamento.id,
                  money,
                }),
                formatDate,
                money,
              });
              return gerarHtmlFaturaImpressao(
                dados,
                carregarConfigLaboratorio(),
                configFaturas,
                { ...opcoes, locale },
                money
              );
            }}
          />
        </Suspense>
      ) : null}

      <Modal
        open={Boolean(notaCliente)}
        onClose={() => setNotaCliente(null)}
        title="Nota de Cobrança"
        size="xl"
      >
        {notaCliente && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => void imprimirNota(notaCliente)}>
                Imprimir Nota
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNotaCliente(null)}>
                Fechar
              </Button>
            </div>
            <iframe
              title="Fatura"
              srcDoc={faturaHtml(notaCliente, notaCliente.lancamentos[0])}
              className="h-[min(297mm,80vh)] w-full max-w-[210mm] rounded border border-slate-200 bg-white"
            />
          </div>
        )}
      </Modal>

      {modalNaoFaturados ? (
        <Suspense fallback={null}>
          <ServicosNaoFaturadosModalLazy
            open
            onClose={() => setModalNaoFaturados(false)}
            trabalhos={trabalhosNaoFaturadosAtivos}
            valorTrabalho={valorTrabalho}
          />
        </Suspense>
      ) : null}

      {open ? (
        <Suspense fallback={null}>
          <LancarReceitaOsModalLazy
            open
            onClose={() => setOpen(false)}
            onSubmit={save}
            form={form}
            setForm={setForm}
            clientes={clientes}
            trabalhosParaReceita={trabalhosParaReceita}
            osSelecionadas={osSelecionadas}
            toggleOsReceita={toggleOsReceita}
            toggleSelecionarTodasReceita={toggleSelecionarTodasReceita}
            todasReceitaSelecionadas={todasReceitaSelecionadas}
            algumasReceitaSelecionadas={algumasReceitaSelecionadas}
            valorOsSelecionadas={valorOsSelecionadas}
            totalLiquido={totalLiquido}
            creditoDisponivel={creditoDisponivelReceita}
            mensagemLancamento={mensagemLancamento}
            mensagemLancamentoTipo={mensagemLancamentoTipo}
            formaSelecionadaEhBoleto={formaSelecionadaEhBoleto}
            pixAsaasDisponivel={pixAsaasDisponivel}
            valorTrabalho={valorTrabalho}
            onLimparOsSelecionadas={() => setOsSelecionadas([])}
            money={money}
            currency={currency}
            formatDecimalInput={formatDecimalInput}
            formatCurrencyInput={formatCurrencyInput}
            salvando={salvandoLancamento}
          />
        </Suspense>
      ) : null}

      {relatorioAberto ? (
        <Suspense fallback={null}>
          <RelatorioContasReceberModalLazy
            open
            onClose={() => setRelatorioAberto(false)}
            lancamentos={data?.lancamentos ?? []}
            contatosClientes={clientes.map((c) => ({
              id: c.id,
              nome: c.nome,
              celular: c.celular,
            }))}
            trabalhos={trabalhos.map((t) => ({
              id: t.id,
              numeroOs: t.numeroOs,
              status: t.status,
              paciente: t.paciente?.nome ?? null,
              tipoProtese: t.tipoProtese,
              valor: t.valor,
              dentes: t.dentes,
              cor: t.cor,
              instrucoes: t.instrucoes,
              dataEntrega: t.dataEntrega ?? null,
              dataPrevista: t.dataPrevista ?? null,
              cliente: t.cliente
                ? { id: t.cliente.id, nome: t.cliente.nome, cro: t.cliente.cro }
                : null,
            }))}
          />
        </Suspense>
      ) : null}

      <PixQrRecebimentoModal
        open={pixQrRecebimento !== null}
        onClose={() => setPixQrRecebimento(null)}
        dados={pixQrRecebimento}
        money={currency}
      />
    </div>
  );
}

export default function FinanceiroPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Carregando...</p>}>
      <FinanceiroRouter />
    </Suspense>
  );
}
