"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Eye, FileText, Pencil, Plus, Printer, RefreshCw, Search, Trash2 } from "lucide-react";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
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
  lancamentoFaturaOsAtivo,
  trabalhoEstaFaturado,
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
import { htmlCabecalhoLab, labImpressaoFromConfig } from "@/lib/lab-logo";
import { ContaBancariaConteudo } from "@/components/financeiro/ContaBancariaConteudo";
import { ContasPagarConteudo } from "@/components/financeiro/ContasPagarConteudo";
import { RelatorioContasReceberModal } from "@/components/financeiro/RelatorioContasReceberModal";
import { ServicosNaoFaturadosModal } from "@/components/financeiro/ServicosNaoFaturadosModal";
import {
  LancarReceitaOsModal,
  type LancarReceitaOsSubmit,
  type ParcelaLinhaReceita,
} from "@/components/financeiro/LancarReceitaOsModal";
import { ImprimirReciboModal } from "@/components/financeiro/ImprimirReciboModal";
import {
  LancarRecebimentoModal,
  type LancarRecebimentoConfirmacao,
  type LancamentoRecebimento,
} from "@/components/financeiro/LancarRecebimentoModal";
import { VisualizacaoClienteReceberModal } from "@/components/financeiro/VisualizacaoClienteReceberModal";
import { PlanoContasConteudo } from "@/components/financeiro/PlanoContasConteudo";
import { notificarFinanceiroAtualizado } from "@/lib/financeiro-events";
import { empacotarDespesa, type AnexoDespesa } from "@/lib/lancamento-despesa";
import {
  carregarPlanoContas,
  categoriaPadraoLancamento,
} from "@/lib/plano-contas";
import { abrirPdfNoVisualizador, prepararAbaPdf } from "@/lib/pdf-viewer";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import type { LinhaReciboRecebimento } from "@/lib/recibo-recebimento";

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
  instrucoes?: string | null;
  dataPrevista?: string | null;
  dataEntrega?: string | null;
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

function valorTrabalho(trabalho: {
  instrucoes?: string | null;
  valor?: number;
  tipoProtese?: string;
}) {
  const linhasItens = (trabalho.instrucoes || "")
    .split("\n")
    .filter((line) => line.trim().startsWith("Item adicionado:"));
  const totalItens = linhasItens.reduce((sum, line) => {
    const match = line.match(/valor\s*(.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i);
    return sum + parseMoney(match?.[1] || "");
  }, 0);
  return totalItens || trabalho.valor || 0;
}

function itensNotaFromTrabalho(trabalho: Trabalho) {
  const itens = (trabalho.instrucoes || "")
    .split("\n")
    .map((line) => {
      const match = line.match(
        /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*(.*?)\s*-\s*cor\s*(.*?)\s*-\s*qtd\s*(.*?)\s*-\s*valor\s*(.*)$/i
      );
      if (!match) return null;
      return {
        servico: match[1]?.trim() || trabalho.tipoProtese,
        dentes: match[2]?.trim() || trabalho.dentes || "-",
        quantidade: match[4]?.trim() || "1",
        valor: parseMoney(line.match(/ - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i)?.[1] || match[5] || ""),
      };
    })
    .filter(Boolean) as Array<{ servico: string; dentes: string; quantidade: string; valor: number }>;

  return itens.length
    ? itens
    : [
        {
          servico: trabalho.tipoProtese,
          dentes: trabalho.dentes || "-",
          quantidade: "1",
          valor: trabalho.valor || 0,
        },
      ];
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

function lancamentoTemOs(lancamento: Lancamento, numerosOs: number[], trabalhoId?: string) {
  if (trabalhoId && lancamento.trabalho?.id === trabalhoId) return true;
  const numerosLancamento = numerosOsDoLancamento(lancamento);
  return numerosLancamento.some((numero) => numerosOs.includes(numero));
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

function FinanceiroRouter() {
  const searchParams = useSearchParams();
  if (searchParams.get("aba") === "plano-de-contas") {
    return <PlanoContasConteudo />;
  }
  if (searchParams.get("aba") === "conta-bancaria") {
    return <ContaBancariaConteudo />;
  }
  if (searchParams.get("tipo") === "despesa") {
    return <ContasPagarConteudo />;
  }
  return <FinanceiroReceberConteudo />;
}

function FinanceiroReceberConteudo() {
  const searchParams = useSearchParams();
  const notifDeepLinkFeito = useRef(false);
  const saveEmAndamentoRef = useRef(false);
  const referenciasCarregadasRef = useRef(false);
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
  const [modalNaoFaturados, setModalNaoFaturados] = useState(false);
  const [mensagemLancamento, setMensagemLancamento] = useState("");
  const [mensagemLancamentoTipo, setMensagemLancamentoTipo] = useState<
    "sucesso" | "erro" | "info"
  >("info");
  const [recebendoCliente, setRecebendoCliente] = useState<ClienteReceber | null>(null);
  const [detalheCliente, setDetalheCliente] = useState<ClienteReceber | null>(null);
  const [notaCliente, setNotaCliente] = useState<ClienteReceber | null>(null);
  const [clienteCollapseAberto, setClienteCollapseAberto] = useState<string | null>(null);
  const [faturaEditando, setFaturaEditando] = useState<Lancamento | null>(null);
  const [detalheRecebimento, setDetalheRecebimento] = useState<{
    cliente: ClienteReceber;
    lancamento: Lancamento;
  } | null>(null);
  const [reciboRecebimento, setReciboRecebimento] = useState<{
    clienteNome: string;
    linhas: LinhaReciboRecebimento[];
  } | null>(null);
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

  async function carregarLancamentosReceita() {
    const financeiroRes = await fetch("/api/financeiro?tipo=receita");
    const financeiroData = await lerJsonResposta<{
      lancamentos?: Lancamento[];
      resumo?: { totalReceitas: number; totalDespesas: number; saldo: number; receitasPendentes: number };
      error?: string;
    }>(financeiroRes);

    if (!financeiroRes.ok || !financeiroData?.lancamentos) {
      setMensagemLancamentoTipo("erro");
      setMensagemLancamento(
        financeiroData?.error ||
          "Não foi possível carregar o financeiro. Reinicie o servidor após atualizar o banco (prisma generate)."
      );
      setData({
        lancamentos: [],
        resumo: { totalReceitas: 0, totalDespesas: 0, saldo: 0, receitasPendentes: 0 },
      });
      return;
    }

    setData({
      lancamentos: financeiroData.lancamentos,
      resumo: financeiroData.resumo || {
        totalReceitas: 0,
        totalDespesas: 0,
        saldo: 0,
        receitasPendentes: 0,
      },
    });
  }

  async function carregarReferencias() {
    const [clientesRes, trabalhosRes] = await Promise.all([
      fetch("/api/clientes"),
      fetch("/api/trabalhos"),
    ]);
    const clientesData = await lerJsonResposta<Cliente[]>(clientesRes);
    if (Array.isArray(clientesData)) setClientes(clientesData);
    const trabalhosData = await lerJsonResposta<Trabalho[]>(trabalhosRes);
    if (Array.isArray(trabalhosData)) setTrabalhos(trabalhosData);
    referenciasCarregadasRef.current = true;
  }

  async function load(opts?: { comReferencias?: boolean }) {
    const precisaReferencias =
      opts?.comReferencias ?? !referenciasCarregadasRef.current;
    if (precisaReferencias) {
      await Promise.all([carregarLancamentosReceita(), carregarReferencias()]);
      return;
    }
    await carregarLancamentosReceita();
  }

  async function loadPosMutacao() {
    await Promise.all([carregarLancamentosReceita(), fetch("/api/trabalhos").then(async (res) => {
      const trabalhosData = await lerJsonResposta<Trabalho[]>(res);
      if (Array.isArray(trabalhosData)) setTrabalhos(trabalhosData);
    })]);
    notificarFinanceiroAtualizado();
  }

  useEffect(() => {
    void load({ comReferencias: true });
  }, []);

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

  function trabalhosDaFatura(lancamento: Lancamento) {
    const numerosOs = numerosOsDoLancamento(lancamento);
    return trabalhos.filter(
      (trabalho) =>
        trabalho.id === lancamento.trabalho?.id ||
        numerosOs.includes(trabalho.numeroOs)
    );
  }

  function faturaSomenteComOsFinalizadas(lancamento: Lancamento) {
    const descricao = lancamento.descricao.toLowerCase();
    if (!descricao.startsWith("cobrança os")) return true;
    const trabalhosRelacionados = trabalhosDaFatura(lancamento);
    if (trabalhosRelacionados.length === 0) return true;
    return trabalhosRelacionados.every((trabalho) =>
      ["entregue", "finalizado"].includes(trabalho.status)
    );
  }

  function complementoDescricaoCobranca(descricao: string) {
    if (!descricao.toLowerCase().startsWith("cobrança os")) return descricao;
    return descricao
      .replace(/@@trab:[a-zA-Z0-9_,-]+@@/g, "")
      .split(" - ")
      .slice(1)
      .join(" - ")
      .trim();
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

  const clientesReceber = useMemo(() => {
    const grupos = new Map<string, ClienteReceber>();

    receitasFiltradas.forEach((lancamento) => {
      const nome = lancamento.cliente?.nome || "Sem cliente informado";
      const chave = lancamento.cliente?.id || `sem-cliente-${nome}`;
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
        grupo.adiantamentos += lancamento.valor;
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
      if (lancamento.status === "pago") {
        grupo.recebido += lancamento.valor;
      } else {
        grupo.aReceber += saldoFatura(lancamento);
      }
      grupos.set(chave, grupo);
    });

    trabalhosNaoFaturados.forEach((trabalho) => {
      const nome = trabalho.cliente?.nome || "Sem cliente informado";
      const chave = trabalho.cliente?.id || `sem-cliente-${nome}`;
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
        adiantamentos: creditoDisponivelCliente(grupo.clienteId),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [receitasFiltradas, trabalhosNaoFaturados]);

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

    return receitasFiltradas.reduce(
      (acc, l) => {
        if (isCreditoGerado(l)) {
          acc.adiantamentos += l.valor;
          return acc;
        }
        if (isCreditoUtilizado(l)) return acc;
        if (!isFaturaContasReceber(l)) return acc;
        const pendente = l.status !== "pago";
        if (pendente) acc.aReceber += saldoFatura(l);
        if (pendente && dateOnly(l.data) < hoje) acc.atraso += l.valor;
        if (l.status === "pago") acc.recebidas += l.valor;
        acc.naoFaturados += pendente ? l.valor : 0;
        return acc;
      },
      { aReceber: 0, atraso: 0, recebidas: 0, adiantamentos: 0, naoFaturados: 0 }
    );
  }, [receitasFiltradas]);

  const trabalhosSelecionados = useMemo(
    () => trabalhos.filter((trabalho) => osSelecionadas.includes(trabalho.id)),
    [trabalhos, osSelecionadas]
  );
  const totalNaoFaturados = useMemo(
    () => trabalhosNaoFaturados.reduce((sum, trabalho) => sum + valorTrabalho(trabalho), 0),
    [trabalhosNaoFaturados]
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
  const creditoDisponivel = creditoDisponivelCliente(form.clienteId);
  const creditoAplicado = Math.min(creditoDisponivel, totalLiquido);
  const totalAReceberComCredito = Math.max(0, totalLiquido - creditoAplicado);
  const deveCriarFaturaReceber = Math.round(totalAReceberComCredito * 100) > 0;

  function formaSelecionadaEhBoleto() {
    return (form.formaPagamento || "").toLowerCase().includes("boleto");
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
    if (!v || v === "Forma Pagamento") return "Pix";
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
    anexos,
  }: LancarReceitaOsSubmit) {
    if (saveEmAndamentoRef.current) return;
    saveEmAndamentoRef.current = true;
    setSalvandoLancamento(true);
    try {
    setMensagemLancamento("");
    const descricaoBase = trabalhosSelecionados.length
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

    if (deveCriarFaturaReceber) {
      const basePorParcela =
        parcelas.length > 0 ? totalAReceberComCredito / parcelas.length : totalAReceberComCredito;

      if (parcelas.length > 1) {
        const res = await fetch("/api/financeiro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "receita",
            clienteId: form.clienteId || undefined,
            descricao: descricaoCobranca,
            trabalhoId: trabalhosSelecionados.length === 1 ? trabalhosSelecionados[0].id : undefined,
            parcelas: parcelas.map((p) => ({
              valor: valorParcelaNumerico(p, basePorParcela),
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
      } else {
        const p = parcelas[0];
        const valorLancamento = p
          ? valorParcelaNumerico(p, totalAReceberComCredito)
          : totalAReceberComCredito;
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
            trabalhoId: trabalhosSelecionados.length === 1 ? trabalhosSelecionados[0].id : undefined,
            descricao: descricaoCobranca,
            emitirBoleto: formaSelecionadaEhBoleto() && !algumRecebido,
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
        } else if (formaSelecionadaEhBoleto() && !algumRecebido) {
          setMensagemLancamentoTipo("sucesso");
          setMensagemLancamento("Cobrança lançada.");
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
          formaPagamento: "Crédito do cliente",
          descricao: descricaoReceitaComPlano(
            `Desconto com crédito - ${descricaoBase}`,
            anexos
          ),
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

  async function remove(id: string, contextoCliente?: ClienteReceber) {
    const lancamento = data?.lancamentos.find((item) => item.id === id);
    const numerosDiretos = lancamento ? numerosOsDoLancamento(lancamento) : [];
    const contextoRelacionados =
      lancamento && numerosDiretos.length === 0 && contextoCliente
        ? contextoCliente.lancamentos.filter(
            (item) =>
              item.id !== lancamento.id &&
              item.tipo === "receita" &&
              item.descricao.toLowerCase().startsWith("cobrança os") &&
              Math.abs(item.valor - lancamento.valor) < 0.01
          )
        : [];
    const numerosOs = Array.from(
      new Set([
        ...numerosDiretos,
        ...contextoRelacionados.flatMap((item) => numerosOsDoLancamento(item)),
      ])
    );
    const relacionados = lancamento
      ? (data?.lancamentos || []).filter(
          (item) =>
            item.id !== lancamento.id &&
            item.tipo === "receita" &&
            item.descricao.toLowerCase().startsWith("cobrança os") &&
            (lancamentoTemOs(item, numerosOs, lancamento.trabalho?.id) ||
              contextoRelacionados.some((relacionado) => relacionado.id === item.id))
        )
      : [];
    const creditosUtilizados = lancamento
      ? [
          ...creditosUtilizadosDaFatura(lancamento),
          ...relacionados.flatMap((item) => creditosUtilizadosDaFatura(item)),
        ]
      : [];
    const idsParaExcluir = Array.from(
      new Set([id, ...relacionados.map((item) => item.id), ...creditosUtilizados.map((item) => item.id)])
    );
    const avisos: string[] = [];
    if (numerosOs.length > 0 || lancamento?.trabalho?.numeroOs) {
      avisos.push(
        "Atenção!! As OS voltarão para Entregues | Finalizados não faturados."
      );
    }
    if (relacionados.length) {
      avisos.push(
        `Também serão excluídos ${relacionados.length} lançamento(s) financeiro(s) relacionado(s) a essas OS.`
      );
    }
    if (creditosUtilizados.length) {
      avisos.push("O crédito usado nesta fatura voltará para Adiantamentos.");
    }
    setConfirmacaoExclusao({
      title: "Excluir Lançamento",
      message: "Deseja realmente excluir esse lançamento?",
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
        await Promise.all(
          idsParaExcluir.map((lancamentoId) =>
            fetch(`/api/financeiro/${lancamentoId}`, { method: "DELETE" })
          )
        );
        void loadPosMutacao();
      },
    });
  }

  async function estornarRecebimento(lancamento: Lancamento) {
    if (isCreditoUtilizado(lancamento)) {
      setConfirmacaoExclusao({
        title: "Excluir Recebimento",
        message: "Deseja realmente estornar esse Recebimento?",
        onConfirm: async () => {
          await fetch(`/api/financeiro/${lancamento.id}`, { method: "DELETE" });
          setDetalheRecebimento(null);
          setReciboRecebimento(null);
          void loadPosMutacao();
        },
      });
      return;
    }

    if (isCreditoGerado(lancamento)) {
      setConfirmacaoExclusao({
        title: "Excluir Recebimento",
        message: "Deseja realmente estornar esse Recebimento?",
        onConfirm: async () => {
          await fetch(`/api/financeiro/${lancamento.id}`, { method: "DELETE" });
          setDetalheRecebimento(null);
          setReciboRecebimento(null);
          void loadPosMutacao();
        },
      });
      return;
    }

    const numerosOs = numerosOsDoLancamento(lancamento);
    const creditosUtilizados = creditosUtilizadosDaFatura(lancamento);
    const saldosRelacionados = (data?.lancamentos || []).filter(
      (item) =>
        item.id !== lancamento.id &&
        item.tipo === "receita" &&
        item.status !== "pago" &&
        item.descricao.toLowerCase().startsWith("cobrança os") &&
        item.descricao.toLowerCase().includes("saldo restante") &&
        lancamentoTemOs(item, numerosOs, lancamento.trabalho?.id)
    );
    const valorTotal = lancamento.valor + saldosRelacionados.reduce((sum, item) => sum + item.valor, 0);

    setConfirmacaoExclusao({
      title: "Excluir Recebimento",
      message: "Deseja realmente estornar esse Recebimento?",
      onConfirm: async () => {
        await fetch(`/api/financeiro/${lancamento.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "pendente",
            valor: valorTotal,
            formaPagamento: lancamento.formaPagamento,
          }),
        });

        await Promise.all(
          [...saldosRelacionados, ...creditosUtilizados].map((item) =>
            fetch(`/api/financeiro/${item.id}`, { method: "DELETE" })
          )
        );

        setDetalheRecebimento(null);
        setReciboRecebimento(null);
        void loadPosMutacao();
      },
    });
  }

  function abrirEdicaoFatura(lancamento: Lancamento) {
    setFaturaEditando(lancamento);
    setOsRemovidasEdicao([]);
    setFormEdicaoFatura({
      descricao: lancamento.descricao,
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
    await fetch(`/api/financeiro/${faturaEditando.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: descricaoCobrancaEditada(trabalhosRelacionados, formEdicaoFatura.descricao),
        data: brShortToIso(formEdicaoFatura.data),
        valor: parseMoney(formEdicaoFatura.valor),
        formaPagamento: formEdicaoFatura.formaPagamento,
        status: formEdicaoFatura.status,
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
          descricao: descricaoCobrancaEditada(restantes, current.descricao),
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
    if (selecionados.length === 0) return;

    let valorDisponivel = payload.formas.reduce((sum, f) => sum + parseMoney(f.valor), 0);
    const formaPrincipal =
      payload.formas.find((f) => parseMoney(f.valor) > 0)?.forma ?? "Pix Externo";
    const faturasPagas: Lancamento[] = [];

    for (const l of selecionados) {
      if (valorDisponivel <= 0) break;
      const juros = payload.jurosPorFatura[l.id] ?? 0;
      const devido = saldoFatura(l) + juros;
      const valorPago = Math.min(valorDisponivel, devido);
      const saldo = Math.max(devido - valorPago, 0);

      await fetch(`/api/financeiro/${l.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor: valorPago,
          status: "pago",
          formaPagamento: formaPrincipal,
          data: brShortToIso(payload.dataRecebimento),
        }),
      });
      faturasPagas.push({
        ...l,
        valor: valorPago,
        status: "pago",
        formaPagamento: formaPrincipal,
        data: brShortToIso(payload.dataRecebimento),
      });

      if (saldo > 0.009) {
        await fetch("/api/financeiro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "receita",
            descricao: `${l.descricao} - Saldo restante`,
            valor: saldo,
            data: l.data,
            status: "pendente",
            formaPagamento: l.formaPagamento || formaPrincipal,
            clienteId: l.cliente?.id,
            trabalhoId: l.trabalho?.id,
          }),
        });
      }

      valorDisponivel -= valorPago;
    }

    if (valorDisponivel > 0.009) {
      await fetch("/api/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "receita",
          clienteId: recebendoCliente.clienteId || undefined,
          valor: valorDisponivel,
          data: brShortToIso(payload.dataRecebimento),
          status: "pago",
          formaPagamento: formaPrincipal,
          descricao: "Adiantamento / Crédito cliente",
        }),
      });
      faturasPagas.push({
        id: `credito-${Date.now()}`,
        tipo: "receita",
        descricao: "Adiantamento / Crédito cliente",
        valor: valorDisponivel,
        data: brShortToIso(payload.dataRecebimento),
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
    if (isCreditoGerado(lancamento)) return "Crédito";
    if (isCreditoUtilizado(lancamento)) return "Desconto com crédito";
    if (lancamento.descricao.toLowerCase().startsWith("cobrança os")) return "Pagamento da fatura";
    return "Recebimento";
  }

  function isFaturaContasReceber(lancamento: Lancamento) {
    if (isCreditoGerado(lancamento) || isCreditoUtilizado(lancamento)) return false;
    if (!lancamento.descricao.toLowerCase().startsWith("cobrança os")) return false;
    if (lancamento.formaPagamento?.toLowerCase().includes("crédito")) return false;
    if (!faturaSomenteComOsFinalizadas(lancamento)) return false;
    const creditoQuitouFatura =
      creditoUsadoNaFatura(lancamento) > 0 &&
      Math.round(saldoFatura(lancamento) * 100) <= 0;
    return !creditoQuitouFatura;
  }

  function creditoDisponivelCliente(clienteId?: string) {
    if (!clienteId) return 0;
    const lancamentos = data?.lancamentos || [];
    const creditos = lancamentos
      .filter((lancamento) => lancamento.cliente?.id === clienteId && isCreditoGerado(lancamento))
      .reduce((sum, lancamento) => sum + lancamento.valor, 0);
    const usados = lancamentos
      .filter((lancamento) => lancamento.cliente?.id === clienteId && isCreditoUtilizado(lancamento))
      .reduce((sum, lancamento) => sum + lancamento.valor, 0);
    return Math.max(creditos - usados, 0);
  }

  function creditoUsadoNaFatura(lancamento: Lancamento) {
    return creditosUtilizadosDaFatura(lancamento)
      .reduce((sum, item) => sum + item.valor, 0);
  }

  function creditosUtilizadosDaFatura(lancamento: Lancamento) {
    return (data?.lancamentos || [])
      .filter(
        (item) =>
          isCreditoUtilizado(item) &&
          item.cliente?.id === lancamento.cliente?.id &&
          item.descricao.includes(lancamento.descricao)
      );
  }

  function recebidoNaFatura(lancamento: Lancamento) {
    if (lancamento.status === "pago") return lancamento.valor;
    return Math.min(creditoUsadoNaFatura(lancamento), lancamento.valor);
  }

  function saldoFatura(lancamento: Lancamento) {
    return Math.max(lancamento.valor - recebidoNaFatura(lancamento), 0);
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

  function situacaoFatura(lancamento: Lancamento) {
    if (lancamento.status === "pago") {
      return { label: "Recebido", color: "bg-emerald-100 text-emerald-700" };
    }
    if (lancamento.status === "cancelado") {
      return { label: "Cancelado", color: "bg-slate-100 text-slate-600" };
    }
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = dateOnly(lancamento.data);
    return vencimento < hoje
      ? { label: "Vencido", color: "bg-red-100 text-red-700" }
      : { label: "Em dia", color: "bg-emerald-100 text-emerald-700" };
  }

  function situacaoFaturaLabel(lancamento: Lancamento) {
    const situacao = situacaoFatura(lancamento);
    const aReceber = lancamento.status !== "pago" && saldoFatura(lancamento) > 0.009;
    return {
      label: aReceber ? "A RECEBER" : situacao.label.toUpperCase(),
      aReceber,
    };
  }

  function abrirClienteModal(cliente: ClienteReceber) {
    setDetalheCliente(cliente);
  }

  function faturaHtml(cliente: ClienteReceber) {
    const lancamentos = cliente.lancamentos.filter((l) => l.tipo === "receita");
    const primeiraFatura = lancamentos[0];
    const credito = primeiraFatura ? creditoUsadoNaFatura(primeiraFatura) : 0;
    let totalServicos = 0;
    const linhas = lancamentos
      .flatMap((l) => {
        const trabalho = trabalhos.find(
          (item) =>
            item.id === l.trabalho?.id ||
            (l.trabalho?.numeroOs && item.numeroOs === l.trabalho.numeroOs)
        );
        if (!trabalho) {
          const os = l.trabalho?.numeroOs || "-";
          totalServicos += l.valor;
          return [`<tr><td>${os}</td><td>${l.descricao}</td><td>-</td><td>-</td><td class="center">1</td><td class="right">${money(l.valor)}</td><td class="right">0,00 %</td><td class="right">${money(l.valor)}</td></tr>`];
        }
        return itensNotaFromTrabalho(trabalho).map((item) => {
          const quantidade = Number(String(item.quantidade).replace(",", ".")) || 1;
          const subtotal = item.valor * quantidade;
          totalServicos += subtotal;
          const data = trabalho.dataPrevista ? formatDate(trabalho.dataPrevista) : formatDate(l.data);
          return `<tr>
            <td>${trabalho.numeroOs}<br/><span>Data: ${data}</span></td>
            <td>${item.servico}</td>
            <td>${item.dentes}</td>
            <td>${trabalho.paciente?.nome || "-"}</td>
            <td class="center">${item.quantidade}</td>
            <td class="right">${money(item.valor)}</td>
            <td class="right">0,00 %</td>
            <td class="right">${money(subtotal)}</td>
          </tr>`;
        });
      })
      .join("");
    const totalFinal = Math.max(totalServicos - credito, 0);
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
          <div><span>Desconto Fatura (-)</span><span class="right">R$ ${money(credito)}</span></div>
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
        tituloRelatorio: `Nota de Cobrança — ${cliente.nome}`,
        colunas: [
          { titulo: "Descrição", larguraMm: 110, alinhamento: "left" },
          { titulo: "Valor", larguraMm: 66, alinhamento: "right" },
        ],
        linhas: receitas.map((l) => [l.descricao, currency(l.valor)]),
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
    return lancamentos.map((l) => ({
      valor: l.valor,
      data: l.data,
      formaPagamento: l.formaPagamento,
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

  if (!data) return <p>Carregando...</p>;

  return (
    <div className="space-y-3 text-[11px] text-slate-700">
      <div
        className={cn(
          "grid gap-3",
          trabalhosNaoFaturados.length > 0 ? "md:grid-cols-4" : "md:grid-cols-3"
        )}
      >
        <div className="rounded border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-800">{money(resumoReceber.aReceber)}</p>
              <p className="text-[11px] text-slate-500">Adiantamentos {money(resumoReceber.adiantamentos)} | A Receber {money(resumoReceber.aReceber)}</p>
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
              <p className="text-[11px] text-slate-500">Contas em Atraso</p>
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
              <p className="text-[11px] text-slate-500">Contas Recebidas</p>
            </div>
            <span className="rounded-full bg-emerald-50 p-2 text-emerald-500">
              <Check className="h-4 w-4" />
            </span>
          </div>
        </div>
        {trabalhosNaoFaturados.length > 0 ? (
          <div className="rounded border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-800">
                  {money(totalNaoFaturados)}
                </p>
                <p className="text-[11px] text-slate-500">
                  Entregues | Finalizados não faturados{" "}
                  <button
                    type="button"
                    onClick={() => setModalNaoFaturados(true)}
                    className="rounded bg-[#4a90d9] px-1.5 py-0.5 text-[9px] font-normal text-white hover:bg-[#3b7bc4]"
                  >
                    Ver
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
          Lançar Receita (Sem Cobrança)
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="bg-primary-600 text-white hover:bg-primary-700"
          onClick={() => setRelatorioAberto(true)}
        >
          <FileText className="h-3.5 w-3.5" />
          Relatórios
        </Button>
        <button className="rounded bg-primary-600 p-2 text-white">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button className="rounded bg-emerald-500 p-2 text-white">
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_1.4fr_auto]">
          <Select label="Período" value={periodo} onChange={(e) => aplicarPeriodo(e.target.value)}>
            <option value="hoje">Hoje</option>
            <option value="semana">Esta Semana</option>
            <option value="mes">Este Mês</option>
            <option value="proximos30">Próximos 30 dias</option>
            <option value="todos">Mostrar Todos</option>
            <option value="outro">Outro Período</option>
            <option value="outro">Data Início / Final</option>
          </Select>
          <CampoDataBr
            label="Data Início"
            value={dataInicio}
            onChange={setDataInicio}
            onValueChange={() => setPeriodo("outro")}
          />
          <CampoDataBr
            label="Data Final"
            value={dataFinal}
            onChange={setDataFinal}
            onValueChange={() => setPeriodo("outro")}
          />
          <Select label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
            <option value="">Mostrar todos</option>
            <option value="receber">A receber</option>
            <option value="atraso">Em atraso</option>
          </Select>
          <Input
            label="Procurar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar"
          />
          <Button className="mt-6" size="sm" variant="secondary" onClick={limparFiltros}>
            Limpar
          </Button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left font-semibold uppercase">Nome</th>
                <th className="px-3 py-2 text-right font-semibold uppercase">A Receber</th>
                <th className="px-3 py-2 text-right font-semibold uppercase">Recebido</th>
                <th className="px-3 py-2 text-right font-semibold uppercase">Adiantamentos</th>
                <th className="px-3 py-2 text-right font-semibold uppercase">Não Faturados</th>
                <th className="px-3 py-2 text-center font-semibold uppercase">Opções</th>
              </tr>
            </thead>
            <tbody>
              {clientesReceber.map((cliente) => {
                const chave = clienteKey(cliente);
                const faturasContasReceber = cliente.lancamentos.filter(isFaturaContasReceber);
                const temFatura = faturasContasReceber.length > 0;

                return (
                  <tr
                    key={chave}
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
                      temFatura && clienteTemVencido(cliente)
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
                          Receber
                        </button>
                        <button
                          type="button"
                          title="Visualizar faturas"
                          onClick={() => abrirClienteModal(cliente)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-primary-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {clientesReceber.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    Nenhuma conta a receber encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmacaoExclusaoModal
        open={!!confirmacaoExclusao}
        titulo={confirmacaoExclusao?.title ?? ""}
        mensagem={confirmacaoExclusao?.message ?? ""}
        aviso={confirmacaoExclusao?.aviso}
        detalhe={confirmacaoExclusao?.detalhe}
        tipoConfirmacao={confirmacaoExclusao?.tipoConfirmacao}
        onClose={() => setConfirmacaoExclusao(null)}
        onConfirm={() => {
          if (confirmacaoExclusao) void confirmacaoExclusao.onConfirm();
        }}
      />

      <LancarRecebimentoModal
        open={Boolean(recebendoCliente)}
        onClose={() => setRecebendoCliente(null)}
        clienteNome={recebendoCliente?.nome ?? ""}
        totalDevido={
          recebendoCliente?.lancamentos
            .filter((l) => l.status !== "pago" && isFaturaContasReceber(l))
            .reduce((sum, l) => sum + saldoFatura(l), 0) ?? 0
        }
        faturas={
          recebendoCliente?.lancamentos.filter(
            (l) => l.status !== "pago" && isFaturaContasReceber(l)
          ) ?? []
        }
        numeroFatura={numeroFatura}
        saldoFatura={saldoFatura}
        formatDate={formatDate}
        money={money}
        parseMoney={parseMoney}
        formatCurrencyInput={formatCurrencyInput}
        onConfirmar={(payload, imprimir) => void confirmarRecebimento(payload, imprimir)}
        onVisualizar={(lancamento) => {
          if (!recebendoCliente) return;
          setDetalheRecebimento({
            cliente: recebendoCliente,
            lancamento: lancamento as Lancamento,
          });
        }}
      />

      <VisualizacaoClienteReceberModal
        open={Boolean(detalheCliente)}
        onClose={() => setDetalheCliente(null)}
        cliente={detalheCliente}
        clientes={clientesReceber}
        filtrosPainel={{ dataInicio, dataFinal, situacao }}
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
          if (!detalheCliente) return;
          setDetalheRecebimento({ cliente: detalheCliente, lancamento: l as Lancamento });
        }}
        onImprimirFatura={(l) => {
          if (!detalheCliente) return;
          setNotaCliente({ ...detalheCliente, lancamentos: [l as Lancamento] });
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

      <Modal
        open={Boolean(faturaEditando)}
        onClose={() => setFaturaEditando(null)}
        title="Editar Receita"
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
                          <td className="px-2 py-2">{faturaEditando.descricao}</td>
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
                    onChange={(e) =>
                      setFormEdicaoFatura((current) => ({
                        ...current,
                        formaPagamento: e.target.value,
                      }))
                    }
                    className="h-8 rounded border-slate-300 text-[11px]"
                  >
                    <option>Pix Externo</option>
                    <option>Dinheiro</option>
                    <option>Cartão</option>
                    <option>Boleto</option>
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

      <Modal
        open={Boolean(detalheRecebimento)}
        onClose={() => setDetalheRecebimento(null)}
        title="Detalhes Recebimento"
        size="xl"
      >
        {detalheRecebimento && (
          <div className="space-y-5 text-[13px] text-slate-600">
            <div className="space-y-1">
              <p>
                <strong>Data Recebimento:</strong>{" "}
                {formatDate(detalheRecebimento.lancamento.data)}
              </p>
              <p>
                <strong>Forma:</strong>{" "}
                <span className="rounded bg-cyan-50 px-2 py-0.5 text-xs font-bold text-cyan-700">
                  {detalheRecebimento.lancamento.formaPagamento || "Pix Externo"}
                </span>
              </p>
              <p>
                <strong>Valor Recebido:</strong>{" "}
                {currency(detalheRecebimento.lancamento.valor)}
              </p>
              <p>
                <strong>Observação:</strong>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-slate-500">
                    <th className="px-3 py-3 text-left font-bold uppercase">Nº Fatura</th>
                    <th className="px-3 py-3 text-left font-bold uppercase">Parcela</th>
                    <th className="px-3 py-3 text-left font-bold uppercase">Vencimento</th>
                    <th className="px-3 py-3 text-left font-bold uppercase">Valor</th>
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

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setDetalheRecebimento(null)}
              >
                × Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ImprimirReciboModal
        open={Boolean(reciboRecebimento)}
        onClose={() => setReciboRecebimento(null)}
        clienteNome={reciboRecebimento?.clienteNome ?? ""}
        linhas={reciboRecebimento?.linhas ?? []}
      />

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
              srcDoc={faturaHtml(notaCliente)}
              className="h-[min(297mm,80vh)] w-full max-w-[210mm] rounded border border-slate-200 bg-white"
            />
          </div>
        )}
      </Modal>

      <ServicosNaoFaturadosModal
        open={modalNaoFaturados}
        onClose={() => setModalNaoFaturados(false)}
        trabalhos={trabalhosNaoFaturados}
        valorTrabalho={valorTrabalho}
      />

      <LancarReceitaOsModal
        open={open}
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
        creditoAplicado={creditoAplicado}
        totalAReceberComCredito={totalAReceberComCredito}
        mensagemLancamento={mensagemLancamento}
        mensagemLancamentoTipo={mensagemLancamentoTipo}
        formaSelecionadaEhBoleto={formaSelecionadaEhBoleto}
        valorTrabalho={valorTrabalho}
        onLimparOsSelecionadas={() => setOsSelecionadas([])}
        money={money}
        currency={currency}
        formatDecimalInput={formatDecimalInput}
        formatCurrencyInput={formatCurrencyInput}
        salvando={salvandoLancamento}
      />

      <RelatorioContasReceberModal
        open={relatorioAberto}
        onClose={() => setRelatorioAberto(false)}
        lancamentos={data?.lancamentos ?? []}
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
          cliente: t.cliente
            ? { nome: t.cliente.nome, cro: t.cliente.cro }
            : null,
        }))}
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
