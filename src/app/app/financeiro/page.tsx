"use client";

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  filtrarTrabalhoPorSituacaoFaturamento,
  ORDEM_SEGMENTO_FATURAMENTO,
  segmentosCobraveisMesmaOs,
  segmentoEfetivoTrabalho,
  servicoFinalizadoParaCobranca,
  situacaoReceitaVinculaProdutoTransporte,
  situacaoExibicaoTrabalho,
  type ItemOsLinha,
} from "@/lib/trabalho-os-segmento";
import { cn, formatDate, STATUS_TRABALHO } from "@/lib/utils";
import { htmlCabecalhoLab, labImpressaoFromConfig } from "@/lib/lab-logo";
import { ContaBancariaConteudo } from "@/components/financeiro/ContaBancariaConteudo";
import { ContasPagarConteudo } from "@/components/financeiro/ContasPagarConteudo";
import { PlanoContasConteudo } from "@/components/financeiro/PlanoContasConteudo";

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
  cliente?: { id?: string; nome?: string | null } | null;
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

function SituacaoOsBadgeReceita({ trabalho }: { trabalho: Trabalho }) {
  const primeiroItem = primeiroItemLinhaReceita(trabalho);
  const exibicao = situacaoExibicaoTrabalho(trabalho, primeiroItem ?? undefined);

  if (exibicao.kind === "produto") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-600 px-2.5 py-1 text-[10px] font-semibold text-white">
        Produto
      </span>
    );
  }
  if (exibicao.kind === "transporte") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
        Transporte
      </span>
    );
  }
  return (
    <span
      className={`inline-flex rounded px-2 py-1 text-[10px] font-semibold ${
        STATUS_TRABALHO[trabalho.status]?.color || "bg-slate-100 text-slate-700"
      }`}
    >
      {STATUS_TRABALHO[trabalho.status]?.label || trabalho.status}
    </span>
  );
}

function valorTrabalho(trabalho: Trabalho) {
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
  const [modalNaoFaturados, setModalNaoFaturados] = useState(false);
  const [buscaNaoFaturados, setBuscaNaoFaturados] = useState("");
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
    cliente: ClienteReceber;
    lancamento: Lancamento;
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
  const [faturasSelecionadas, setFaturasSelecionadas] = useState<string[]>([]);
  const [recebimentoValor, setRecebimentoValor] = useState("R$ 0,00");
  const [recebimentoForma, setRecebimentoForma] = useState("Pix Externo");
  const [recebimentoData, setRecebimentoData] = useState(dateToBrShort(new Date()));
  const [periodo, setPeriodo] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [situacao, setSituacao] = useState("");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState({
    tipo: "receita",
    clienteId: "",
    convenio: "",
    categoria: "Honorários de Serviços",
    descricao: "",
    valor: "",
    descontoTipo: "percentual",
    desconto: "0",
    juros: "0",
    acrescimo: false,
    data: dateToBrShort(new Date()),
    pedidoInicio: "",
    pedidoFinal: "",
    situacaoOs: "",
    vencimento: dateToBrShort(new Date()),
    status: "pendente",
    formaPagamento: "Forma Pagamento",
    conta: "Caixa Principal",
    parcela: "1",
    observacoes: "",
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

  async function load() {
    const cacheBust = Date.now();
    const [financeiroRes, clientesRes, trabalhosRes] = await Promise.all([
      fetch(`/api/financeiro?tipo=receita&_=${cacheBust}`, { cache: "no-store" }),
      fetch(`/api/clientes?_=${cacheBust}`, { cache: "no-store" }),
      fetch(`/api/trabalhos?_=${cacheBust}`, { cache: "no-store" }),
    ]);

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
    } else {
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

    const clientesData = await lerJsonResposta<Cliente[]>(clientesRes);
    if (Array.isArray(clientesData)) setClientes(clientesData);

    const trabalhosData = await lerJsonResposta<Trabalho[]>(trabalhosRes);
    if (Array.isArray(trabalhosData)) setTrabalhos(trabalhosData);
  }

  useEffect(() => {
    load();
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
          lancamento.status !== "cancelado" &&
          (lancamento.descricao.toLowerCase().startsWith("cobrança os") ||
            isCreditoUtilizado(lancamento))
      ),
    [data]
  );

  const trabalhosNaoFaturados = useMemo(() => {
    return trabalhos.filter(
      (trabalho) =>
        ["entregue", "finalizado"].includes(trabalho.status) &&
        !cobrancasAtivas.some((lancamento) =>
          lancamento.trabalho?.id === trabalho.id ||
          numerosOsDoLancamento(lancamento).includes(trabalho.numeroOs)
        )
    );
  }, [cobrancasAtivas, trabalhos]);

  const trabalhoJaFaturado = (trabalho: Trabalho) =>
    cobrancasAtivas.some((lancamento) => lancamento.trabalho?.id === trabalho.id);

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
      incluidos.set(vinculado.id, vinculado);
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
    return descricao.split(" - ").slice(1).join(" - ");
  }

  function descricaoCobrancaEditada(trabalhosRelacionados: Trabalho[], descricaoAtual: string) {
    if (!trabalhosRelacionados.length) return descricaoAtual;
    const complemento = complementoDescricaoCobranca(descricaoAtual);
    return `Cobrança OS ${trabalhosRelacionados.map((trabalho) => trabalho.numeroOs).join(", ")}${
      complemento ? ` - ${complemento}` : ""
    }`;
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

    const detalhes = lancamentosDoCliente(cliente);
    setClienteCollapseAberto(clienteKey(cliente));
    setBusca(cliente.nome);

    if (lancamentoId) {
      const lanc = detalhes.lancamentos.find((l) => l.id === lancamentoId);
      if (!lanc) return;
      if (acao === "nota") {
        setNotaCliente({ ...detalhes, lancamentos: [lanc] });
      } else if (acao === "receber") {
        setRecebendoCliente(detalhes);
        setFaturasSelecionadas([lancamentoId]);
      } else {
        setDetalheCliente(detalhes);
      }
      return;
    }

    if (acao === "receber") setRecebendoCliente(detalhes);
    else if (acao === "faturas" || acao === "nota") setDetalheCliente(detalhes);
  }, [data, searchParams, clientesReceber]);

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
  const trabalhosNaoFaturadosFiltrados = useMemo(() => {
    const termo = buscaNaoFaturados.trim().toLowerCase();
    if (!termo) return trabalhosNaoFaturados;
    return trabalhosNaoFaturados.filter((trabalho) =>
      [
        trabalho.numeroOs,
        trabalho.cliente?.nome,
        trabalho.paciente?.nome,
        trabalho.tipoProtese,
        trabalho.dentes,
        trabalho.cor,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(termo))
    );
  }, [trabalhosNaoFaturados, buscaNaoFaturados]);
  const totalNaoFaturados = trabalhosNaoFaturados.reduce((sum, trabalho) => sum + valorTrabalho(trabalho), 0);
  const valorOsSelecionadas = trabalhosSelecionados.reduce((sum, trabalho) => sum + valorTrabalho(trabalho), 0);
  const valorBruto = valorOsSelecionadas;
  const descontoBase = parseDecimal(form.desconto || "0");
  const desconto =
    form.descontoTipo === "valor"
      ? descontoBase
      : valorBruto * (Math.min(Math.max(descontoBase, 0), 100) / 100);
  const jurosPercentual = parseDecimal(form.juros || "0");
  const jurosValor = Math.max(valorBruto - desconto, 0) * (Math.max(jurosPercentual, 0) / 100);
  const totalLiquido = Math.max(0, valorBruto - desconto + jurosValor);
  const creditoDisponivel = creditoDisponivelCliente(form.clienteId);
  const creditoAplicado = Math.min(creditoDisponivel, totalLiquido);
  const totalAReceberComCredito = Math.max(0, totalLiquido - creditoAplicado);
  const deveCriarFaturaReceber = Math.round(totalAReceberComCredito * 100) > 0;

  function formaSelecionadaEhBoleto() {
    return (form.formaPagamento || "").toLowerCase().includes("boleto");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMensagemLancamento("");
    const descricaoCobranca = trabalhosSelecionados.length
      ? `Cobrança OS ${trabalhosSelecionados.map((trabalho) => trabalho.numeroOs).join(", ")}${
          form.descricao ? ` - ${form.descricao}` : ""
        }`
      : form.descricao || "Receita sem cobrança";
    if (deveCriarFaturaReceber) {
      const res = await fetch("/api/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "receita",
          clienteId: form.clienteId || undefined,
          valor: totalAReceberComCredito,
          data: brShortToIso(form.vencimento || form.data),
          formaPagamento: form.formaPagamento,
          status: "pendente",
          trabalhoId: trabalhosSelecionados.length === 1 ? trabalhosSelecionados[0].id : undefined,
          descricao: descricaoCobranca,
          emitirBoleto: formaSelecionadaEhBoleto(),
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
      if (payload.cobrancaAsaas?.bankSlipUrl) {
        setMensagemLancamentoTipo("sucesso");
        setMensagemLancamento("Boleto emitido no Asaas. Abrindo PDF…");
        window.open(payload.cobrancaAsaas.bankSlipUrl, "_blank", "noopener,noreferrer");
      } else if (formaSelecionadaEhBoleto()) {
        setMensagemLancamentoTipo("sucesso");
        setMensagemLancamento("Cobrança lançada.");
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
          descricao: `Desconto com crédito - ${descricaoCobranca}`,
        }),
      });
    }
    if (!mensagemLancamento || mensagemLancamentoTipo !== "erro") {
      setOpen(false);
      setMensagemLancamento("");
    }
    setForm({
      tipo: "receita",
      clienteId: "",
      convenio: "",
      categoria: "Honorários de Serviços",
      descricao: "",
      valor: "",
      descontoTipo: "percentual",
      desconto: "0",
      juros: "0",
      acrescimo: false,
      data: dateToBrShort(new Date()),
      pedidoInicio: "",
      pedidoFinal: "",
      situacaoOs: "",
      vencimento: dateToBrShort(new Date()),
      status: "pendente",
      formaPagamento: "Forma Pagamento",
      conta: "Caixa Principal",
      parcela: "1",
      observacoes: "",
    });
    setOsSelecionadas([]);
    load();
  }

  async function marcarPago(id: string) {
    await fetch(`/api/financeiro/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pago" }),
    });
    load();
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
    const numerosOsLabel = (numerosOs.length
      ? numerosOs
      : [lancamento?.trabalho?.numeroOs]
    )
      .filter(Boolean)
      .join(", ");
    const avisos: string[] = [];
    if (numerosOsLabel) {
      avisos.push(
        `Atenção!! As OS ${numerosOsLabel} voltarão para Entregues | Finalizados não faturados.`
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
        await Promise.all(idsParaExcluir.map((lancamentoId) => fetch(`/api/financeiro/${lancamentoId}`, { method: "DELETE" })));
        setNotaCliente(null);
        setFaturaEditando(null);
        setDetalheRecebimento(null);
        setReciboRecebimento(null);
        setClienteCollapseAberto(null);
        await load();
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
          setClienteCollapseAberto(null);
          await load();
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
          setClienteCollapseAberto(null);
          await load();
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
        setClienteCollapseAberto(null);
        await load();
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
    load();
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

  async function receberCliente(cliente: ClienteReceber) {
    const pendentes = cliente.lancamentos.filter(
      (l) => l.status !== "pago" && l.tipo === "receita" && isFaturaContasReceber(l)
    );
    setRecebendoCliente(cliente);
    setFaturasSelecionadas(pendentes.map((l) => l.id));
    setRecebimentoValor(formatCurrencyInput(String(Math.round(pendentes.reduce((sum, l) => sum + l.valor, 0) * 100))));
    setRecebimentoForma("Pix Externo");
    setRecebimentoData(dateToBrShort(new Date()));
  }

  async function confirmarRecebimento(imprimir = false) {
    if (!recebendoCliente) return;
    const selecionados = recebendoCliente.lancamentos.filter((l) => faturasSelecionadas.includes(l.id));
    if (selecionados.length === 0) return;
    let valorDisponivel = parseMoney(recebimentoValor);
    const faturasPagas: Lancamento[] = [];

    for (const l of selecionados) {
      if (valorDisponivel <= 0) break;
      const valorPago = Math.min(valorDisponivel, l.valor);
      const saldo = Math.max(l.valor - valorPago, 0);

      await fetch(`/api/financeiro/${l.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor: valorPago,
          status: "pago",
          formaPagamento: recebimentoForma,
        }),
      });
      faturasPagas.push({ ...l, valor: valorPago, status: "pago", formaPagamento: recebimentoForma });

      if (saldo > 0) {
        await fetch("/api/financeiro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "receita",
            descricao: `${l.descricao} - Saldo restante`,
            valor: saldo,
            data: l.data,
            status: "pendente",
            formaPagamento: l.formaPagamento || recebimentoForma,
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
          data: brShortToIso(recebimentoData),
          status: "pago",
          formaPagamento: recebimentoForma,
          descricao: "Adiantamento / Crédito cliente",
        }),
      });
      faturasPagas.push({
        id: `credito-${Date.now()}`,
        tipo: "receita",
        descricao: "Adiantamento / Crédito cliente",
        valor: valorDisponivel,
        data: brShortToIso(recebimentoData),
        status: "pago",
        formaPagamento: recebimentoForma,
        cliente: recebendoCliente.clienteId ? { id: recebendoCliente.clienteId, nome: recebendoCliente.nome } : null,
      });
    }

    if (imprimir) {
      imprimirNota({ ...recebendoCliente, lancamentos: faturasPagas });
    }
    setRecebendoCliente(null);
    setFaturasSelecionadas([]);
    load();
  }

  function toggleFatura(id: string) {
    setFaturasSelecionadas((atuais) => {
      const proximas = atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id];
      const total = (recebendoCliente?.lancamentos || [])
        .filter((l) => proximas.includes(l.id))
        .reduce((sum, l) => sum + l.valor, 0);
      setRecebimentoValor(formatCurrencyInput(String(Math.round(total * 100))));
      return proximas;
    });
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

  function lancamentosDoCliente(cliente: ClienteReceber) {
    const inicio = dataInicio ? parseBrShortDate(dataInicio) : null;
    const fim = dataFinal ? parseBrShortDate(dataFinal) : null;
    if (inicio) inicio.setHours(0, 0, 0, 0);
    if (fim) fim.setHours(23, 59, 59, 999);

    const lancamentos = (data?.lancamentos || []).filter((lancamento) => {
      if (lancamento.tipo !== "receita") return false;
      const dataLancamento = new Date(lancamento.data);
      if (inicio && dataLancamento < inicio) return false;
      if (fim && dataLancamento > fim) return false;
      if (cliente.clienteId) return lancamento.cliente?.id === cliente.clienteId;
      return !lancamento.cliente?.id && (lancamento.cliente?.nome || "Sem cliente informado") === cliente.nome;
    });

    return {
      ...cliente,
      lancamentos,
      aReceber: lancamentos
        .filter((lancamento) => lancamento.status !== "pago")
        .reduce((sum, lancamento) => sum + lancamento.valor, 0),
      recebido: lancamentos
        .filter((lancamento) => lancamento.status === "pago")
        .reduce((sum, lancamento) => sum + lancamento.valor, 0),
      adiantamentos: lancamentos
        .filter((lancamento) => lancamento.formaPagamento?.toLowerCase().includes("adiant"))
        .reduce((sum, lancamento) => sum + lancamento.valor, 0),
      naoFaturados: lancamentos
        .filter((lancamento) => lancamento.status !== "pago")
        .reduce((sum, lancamento) => sum + lancamento.valor, 0),
    };
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
      *{box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111;font-size:9px;margin:0;padding:24px}
      .page{width:760px;margin:0 auto}
      .actions{text-align:right;margin-bottom:8px}
      .header{display:grid;grid-template-columns:118px 1fr 150px;gap:18px;align-items:center;margin:20px 0 22px}
      .header:not(:has(.logo)){grid-template-columns:1fr 150px}
      .logo{display:flex;align-items:center;justify-content:flex-start;min-width:76px}
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
      @media print{body{padding:0}.actions{display:none}.page{width:100%;padding:0 18px}}
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

  function imprimirNota(cliente: ClienteReceber) {
    const janela = window.open("", "_blank");
    if (!janela) return;
    janela.document.write(faturaHtml(cliente));
    janela.document.close();
  }

  function dataPorExtenso(value: string | Date) {
    const date = typeof value === "string" ? new Date(value) : value;
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function reciboHtml(lancamento: Lancamento, cliente: ClienteReceber) {
    const numero = numeroFatura(lancamento);
    const vencimento = formatDate(lancamento.data);
    const forma = (lancamento.formaPagamento || "Pix Externo").toUpperCase();
    const valor = currency(lancamento.valor);
    const lab = labImpressaoFromConfig();
    const cabecalhoRecibo = htmlCabecalhoLab(lab, { largura: 70, altura: 55 });

    return `<!doctype html><html><head><title>Recibo</title><style>
      body{font-family:Arial,sans-serif;background:#fff;color:#111;font-size:12px;margin:0;padding:32px}
      .page{max-width:820px;margin:0 auto}
      .top{display:flex;align-items:flex-start;gap:18px;border-bottom:1px solid #222;padding-bottom:10px}
      .logo{display:flex;align-items:center;justify-content:flex-start;flex-shrink:0}
      .lab strong{display:block;font-size:14px}.title{text-align:center;font-size:14px;font-weight:bold;margin:18px 0}
      .amount{text-align:right;font-size:15px;font-weight:bold;margin:8px 0 32px}
      .line{margin:14px 0}.table{width:88%;margin:22px auto;border-collapse:collapse;font-size:11px}
      th,td{border-bottom:1px solid #e5e7eb;padding:7px;text-align:left}th{text-align:center;font-weight:bold}
      td{text-align:center}.footer{text-align:right;margin-top:26px}.sign{width:420px;margin:70px auto 0;text-align:center;border-top:1px solid #444;padding-top:8px}
      .actions{margin-bottom:14px;text-align:right}@media print{.actions{display:none}body{padding:0}.page{max-width:none}}
    </style></head><body>
      <div class="page">
        <div class="actions"><button onclick="window.print()">Imprimir</button></div>
        <div class="top">
          ${cabecalhoRecibo}
        </div>
        <div class="title">RECIBO</div>
        <div class="amount">${valor}</div>
        <div class="line"><strong>Recebi de:</strong> ${cliente.nome}</div>
        <div class="line"><strong>A quantia de:</strong> ${valor}</div>
        <div class="line"><strong>Referente a:</strong> Recebimento das cobranças descritas abaixo:</div>
        <table class="table">
          <thead><tr><th>Forma Pagamento</th><th>Valor</th></tr></thead>
          <tbody>
            <tr><td>${forma}</td><td>${valor}</td></tr>
            <tr><td><strong>Fatura: ${numero}</strong> | Vencimento: ${vencimento}</td><td>${valor}</td></tr>
          </tbody>
        </table>
        <p>e para clareza firmo o presente.</p>
        <p class="footer">Governador Valadares, ${dataPorExtenso(new Date())}.</p>
        <div class="sign">Mateus Bonfim<br/><br/>CNPJ: 65.881.387/0001-88</div>
      </div>
    </body></html>`;
  }

  function imprimirRecibo(lancamento: Lancamento, cliente: ClienteReceber) {
    setReciboRecebimento({ cliente, lancamento });
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
      <div className="grid gap-3 md:grid-cols-4">
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
        <div className="rounded border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-800">{money(totalNaoFaturados)}</p>
              <p className="text-[11px] text-slate-500">
                Entregues | Finalizados não faturados{" "}
                <button
                  type="button"
                  onClick={() => setModalNaoFaturados(true)}
                  className="rounded bg-primary-600 px-1 text-[9px] text-white"
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Lançar Receita (Sem Cobrança)
        </Button>
        <Button size="sm" variant="outline" className="bg-primary-600 text-white hover:bg-primary-700">
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
                const aberto = clienteCollapseAberto === chave;
                const detalhes = lancamentosDoCliente(cliente);
                const faturasContasReceber = detalhes.lancamentos.filter(isFaturaContasReceber);
                const temFatura = faturasContasReceber.length > 0;

                return (
                  <Fragment key={chave}>
                    <tr
                      className={cn(
                        "border-b border-slate-100",
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
                      <td className="px-3 py-2">
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
                      <tr className={cn("border-b", temFatura ? "border-blue-100 bg-blue-50/40" : "border-slate-100 bg-white")}>
                        <td colSpan={6} className="px-3 py-3">
                          <div className="space-y-4">
                            <div className="rounded border border-blue-200 bg-white p-3 shadow-sm">
                              <div className="mb-3 flex items-center gap-2 text-primary-700">
                                <FileText className="h-3.5 w-3.5" />
                                <strong>Contas a Receber</strong>
                              </div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[850px] text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                    <th className="px-2 py-2 text-left">Vencimento</th>
                                    <th className="px-2 py-2 text-left">Nº Fatura</th>
                                    <th className="px-2 py-2 text-left">Parcela</th>
                                    <th className="px-2 py-2 text-left">Forma Recebimento</th>
                                    <th className="px-2 py-2 text-right">Valor</th>
                                    <th className="px-2 py-2 text-right">Recebido</th>
                                    <th className="px-2 py-2 text-right">Saldo</th>
                                    <th className="px-2 py-2 text-left">Situação</th>
                                    <th className="px-2 py-2 text-center">Opções</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {faturasContasReceber.length === 0 && (
                                    <tr>
                                      <td colSpan={9} className="px-2 py-8 text-center text-slate-400">
                                        Nenhuma fatura deste cliente dentro da Data Início e Data Final selecionadas.
                                      </td>
                                    </tr>
                                  )}
                                  {faturasContasReceber.map((l) => {
                                    const situacao = situacaoFatura(l);
                                    return (
                                      <tr key={l.id} className="border-b border-slate-100">
                                        <td className="px-2 py-2">{formatDate(l.data)}</td>
                                        <td className="px-2 py-2">{numeroFatura(l)}</td>
                                        <td className="px-2 py-2">1 / 1</td>
                                        <td className="px-2 py-2">{l.formaPagamento || "-"}</td>
                                        <td className="px-2 py-2 text-right">{money(l.valor)}</td>
                                        <td className="px-2 py-2 text-right">{money(recebidoNaFatura(l))}</td>
                                        <td className="px-2 py-2 text-right">{money(saldoFatura(l))}</td>
                                        <td className="px-2 py-2">
                                          <span className={`rounded px-2 py-1 ${situacao.color}`}>
                                            {situacao.label}
                                          </span>
                                        </td>
                                        <td className="px-2 py-2">
                                          <div className="flex items-center justify-center gap-1">
                                            {l.cobrancaAsaas?.bankSlipUrl ? (
                                              <a
                                                href={l.cobrancaAsaas.bankSlipUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Abrir boleto (PDF)"
                                                className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                                              >
                                                <FileText className="h-3.5 w-3.5" />
                                              </a>
                                            ) : null}
                                            <button
                                              type="button"
                                              title="Imprimir esta nota"
                                              onClick={() => setNotaCliente({ ...detalhes, lancamentos: [l] })}
                                              className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                                            >
                                              <Printer className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              title="Editar fatura"
                                              onClick={() => abrirEdicaoFatura(l)}
                                              className="rounded p-1 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              title="Excluir fatura"
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
                              <strong>Recebimentos</strong>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[720px] text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                    <th className="px-2 py-2 text-left">Data</th>
                                    <th className="px-2 py-2 text-left">Forma Pagamento</th>
                                    <th className="px-2 py-2 text-left">Referência</th>
                                    <th className="px-2 py-2 text-right">Valor</th>
                                    <th className="px-2 py-2 text-center">Opções</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detalhes.lancamentos.filter((l) => l.status === "pago").length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="px-2 py-8 text-center text-slate-400">
                                        Nenhum recebimento encontrado para este cliente no período selecionado.
                                      </td>
                                    </tr>
                                  )}
                                  {detalhes.lancamentos.filter((l) => l.status === "pago").map((l) => (
                                    <tr key={`recebimento-${l.id}`} className="border-b border-slate-100">
                                      <td className="px-2 py-2">{formatDate(l.data)}</td>
                                      <td className="px-2 py-2">
                                        <span className="rounded bg-cyan-50 px-2 py-1 text-cyan-700">
                                          {l.formaPagamento || "-"}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2">
                                        <span className={isCreditoGerado(l) ? "rounded bg-emerald-100 px-2 py-1 text-emerald-700" : isCreditoUtilizado(l) ? "rounded bg-amber-100 px-2 py-1 text-amber-700" : "rounded bg-blue-50 px-2 py-1 text-blue-700"}>
                                          {referenciaLancamento(l)}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2 text-right">{money(l.valor)}</td>
                                      <td className="px-2 py-2">
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            type="button"
                                            title="Estornar recebimento"
                                            onClick={() => estornarRecebimento(l)}
                                            className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            title="Imprimir recibo"
                                            onClick={() => imprimirRecibo(l, detalhes)}
                                            className="inline-flex items-center gap-1 rounded p-1 text-emerald-600 hover:bg-emerald-50"
                                          >
                                            <Printer className="h-3.5 w-3.5" />
                                            <span className="text-[10px]">Recibo</span>
                                          </button>
                                          <button
                                            type="button"
                                            title="Detalhes recebimento"
                                            onClick={() => setDetalheRecebimento({ cliente: detalhes, lancamento: l })}
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
        onConfirm={async () => {
          if (confirmacaoExclusao) {
            await confirmacaoExclusao.onConfirm();
            setConfirmacaoExclusao(null);
          }
        }}
      />

      <Modal
        open={Boolean(recebendoCliente)}
        onClose={() => setRecebendoCliente(null)}
        title="Lançar Recebimento"
        size="xl"
      >
        {recebendoCliente && (
          <div className="space-y-5 text-[11px]">
            <div className="flex items-center justify-between">
              <p>
                Cliente: <strong>{recebendoCliente.nome}</strong>
              </p>
              <p>
                Total Devido:{" "}
                <strong className="text-red-600">
                  {money(recebendoCliente.lancamentos.filter((l) => l.status !== "pago").reduce((sum, l) => sum + l.valor, 0))}
                </strong>
              </p>
            </div>
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="w-full min-w-[820px] text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="px-3 py-2 text-left">Nº Fatura</th>
                    <th className="px-3 py-2 text-left">Parcela</th>
                    <th className="px-3 py-2 text-left">Vencimento</th>
                    <th className="px-3 py-2 text-left">Forma Recebimento</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-right">Juros</th>
                    <th className="px-3 py-2 text-center">Selecionar Fatura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recebendoCliente.lancamentos
                    .filter((l) => l.status !== "pago" && isFaturaContasReceber(l))
                    .map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2">{numeroFatura(l)}</td>
                      <td className="px-3 py-2">1 / 1</td>
                      <td className="px-3 py-2">{formatDate(l.data)}</td>
                      <td className="px-3 py-2">{l.formaPagamento || recebimentoForma}</td>
                      <td className="px-3 py-2 text-right">{money(l.valor)}</td>
                      <td className="px-3 py-2 text-right">0,00</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={faturasSelecionadas.includes(l.id)}
                          onChange={() => toggleFatura(l.id)}
                          className="h-4 w-4 accent-primary-600"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded border border-slate-200 p-3">
              <div className="mb-3 flex items-center justify-between">
                <strong>Lançar Recebimento</strong>
                <label className="inline-flex items-center gap-2 text-slate-500">
                  <input type="checkbox" /> Emitir Nota Fiscal
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Select value={recebimentoForma} onChange={(e) => setRecebimentoForma(e.target.value)}>
                  <option>Pix Externo</option>
                  <option>Dinheiro</option>
                  <option>Cartão</option>
                  <option>Boleto</option>
                </Select>
                <Select value="Caixa Principal" onChange={() => undefined}>
                  <option>Caixa Principal</option>
                  <option>Banco</option>
                </Select>
                <Input
                  selectOnFocus
                  value={recebimentoValor}
                  onChange={(e) => setRecebimentoValor(formatCurrencyInput(e.target.value))}
                  className="text-right"
                  placeholder="Digite o valor recebido"
                />
                <Input
                  value={recebimentoData}
                  onChange={(e) => setRecebimentoData(formatDateInput(e.target.value))}
                  placeholder="Data recebimento"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Button type="button" onClick={() => confirmarRecebimento()}>
                Confirmar Recebimento
              </Button>
              <Button type="button" className="bg-emerald-500 hover:bg-emerald-600" onClick={() => confirmarRecebimento(true)}>
                Confirmar Recebimento e Imprimir Recibo
              </Button>
              <Button type="button" variant="outline" onClick={() => setRecebendoCliente(null)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(detalheCliente)}
        onClose={() => setDetalheCliente(null)}
        title="Visualização de Faturas"
        size="xl"
      >
        {detalheCliente && (() => {
          const faturasContasReceber = detalheCliente.lancamentos.filter(isFaturaContasReceber);
          return (
          <div className="space-y-4 text-[11px]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Cliente selecionado</p>
                  <h3 className="text-sm font-bold text-slate-800">{detalheCliente.nome}</h3>
                  <p className="mt-1 text-slate-500">
                    Período: {dataInicio || "início"} até {dataFinal || "final"}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] text-slate-400">Faturas</p>
                    <strong>{faturasContasReceber.length}</strong>
                  </div>
                  <div className="rounded bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] text-slate-400">A receber</p>
                    <strong>{money(detalheCliente.aReceber)}</strong>
                  </div>
                  <div className="rounded bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] text-slate-400">Recebido</p>
                    <strong>{money(detalheCliente.recebido)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded border border-blue-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <strong className="text-primary-700">Contas a Receber</strong>
                <Button size="sm" variant="outline" onClick={() => setNotaCliente({ ...detalheCliente, lancamentos: faturasContasReceber })} disabled={faturasContasReceber.length === 0}>
                  Gerar / Imprimir Nota de Cobrança
                </Button>
              </div>
              <table className="w-full min-w-[850px] text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="px-2 py-2 text-left">Vencimento</th>
                    <th className="px-2 py-2 text-left">Nº Fatura</th>
                    <th className="px-2 py-2 text-left">Parcela</th>
                    <th className="px-2 py-2 text-left">Forma Recebimento</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                    <th className="px-2 py-2 text-right">Recebido</th>
                    <th className="px-2 py-2 text-right">Saldo</th>
                    <th className="px-2 py-2 text-left">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {faturasContasReceber.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-2 py-8 text-center text-slate-400">
                        Nenhuma fatura deste cliente dentro da Data Início e Data Final selecionadas.
                      </td>
                    </tr>
                  )}
                  {faturasContasReceber.map((l) => {
                    const situacao = situacaoFatura(l);
                    return (
                      <tr key={l.id} className="border-b border-slate-100">
                        <td className="px-2 py-2">{formatDate(l.data)}</td>
                        <td className="px-2 py-2">{numeroFatura(l)}</td>
                        <td className="px-2 py-2">1 / 1</td>
                        <td className="px-2 py-2">{l.formaPagamento || "-"}</td>
                        <td className="px-2 py-2 text-right">{money(l.valor)}</td>
                        <td className="px-2 py-2 text-right">{money(recebidoNaFatura(l))}</td>
                        <td className="px-2 py-2 text-right">{money(saldoFatura(l))}</td>
                        <td className="px-2 py-2">
                          <span className={`rounded px-2 py-1 ${situacao.color}`}>
                            {situacao.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rounded border border-emerald-200 p-3">
              <strong className="text-emerald-700">Recebimentos</strong>
              <table className="mt-2 w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="px-2 py-2 text-left">Data</th>
                    <th className="px-2 py-2 text-left">Forma Pagamento</th>
                    <th className="px-2 py-2 text-left">Referência</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {detalheCliente.lancamentos.filter((l) => l.status === "pago").map((l) => (
                    <tr key={l.id} className="border-b border-slate-100">
                      <td className="px-2 py-2">{formatDate(l.data)}</td>
                      <td className="px-2 py-2">{l.formaPagamento || "-"}</td>
                      <td className="px-2 py-2">{referenciaLancamento(l)}</td>
                      <td className="px-2 py-2 text-right">{money(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          );
        })()}
      </Modal>

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

      <Modal
        open={Boolean(reciboRecebimento)}
        onClose={() => setReciboRecebimento(null)}
        title="Recibo"
        size="xl"
      >
        {reciboRecebimento && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => window.print()}>
                Imprimir Recibo
              </Button>
              <Button type="button" variant="outline" onClick={() => setReciboRecebimento(null)}>
                Fechar
              </Button>
            </div>
            <iframe
              title="Recibo"
              srcDoc={reciboHtml(reciboRecebimento.lancamento, reciboRecebimento.cliente)}
              className="h-[680px] w-full rounded border border-slate-200 bg-white"
            />
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(notaCliente)}
        onClose={() => setNotaCliente(null)}
        title="Nota de Cobrança"
        size="xl"
      >
        {notaCliente && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => imprimirNota(notaCliente)}>
                Imprimir Nota
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNotaCliente(null)}>
                Fechar
              </Button>
            </div>
            <iframe
              title="Fatura"
              srcDoc={faturaHtml(notaCliente)}
              className="h-[720px] w-full rounded border border-slate-200 bg-white"
            />
          </div>
        )}
      </Modal>

      <Modal
        open={modalNaoFaturados}
        onClose={() => setModalNaoFaturados(false)}
        title="Serviços Entregues/Finalizados e não Faturados"
        size="xl"
      >
        <div className="space-y-3 text-[11px]">
          <div className="flex items-end gap-2">
            <Input
              value={buscaNaoFaturados}
              onChange={(e) => setBuscaNaoFaturados(e.target.value)}
              placeholder="OS, situação, paciente, serviço ou cliente"
            />
            <Button size="sm" variant="secondary" onClick={() => setBuscaNaoFaturados("")}>
              Limpar
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-3 py-2 text-left font-semibold uppercase">OS</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Cliente</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Serviço</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Num Dente</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Cor</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Valor</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trabalhosNaoFaturadosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                      Nenhum serviço entregue/finalizado pendente de faturamento.
                    </td>
                  </tr>
                )}
                {trabalhosNaoFaturadosFiltrados.map((trabalho) => (
                  <tr key={trabalho.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">{trabalho.numeroOs}</td>
                    <td className="px-3 py-2">{trabalho.cliente?.nome || "-"}</td>
                    <td className="px-3 py-2">{trabalho.tipoProtese}</td>
                    <td className="px-3 py-2">{trabalho.paciente?.nome || "-"}</td>
                    <td className="px-3 py-2">{trabalho.dentes || "-"}</td>
                    <td className="px-3 py-2">{trabalho.cor || "-"}</td>
                    <td className="px-3 py-2 text-right">{money(valorTrabalho(trabalho))}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-1 text-[10px] font-semibold ${STATUS_TRABALHO[trabalho.status]?.color || "bg-slate-100 text-slate-700"}`}>
                        {STATUS_TRABALHO[trabalho.status]?.label || trabalho.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Lançar Receita"
        size="xl"
      >
        <form onSubmit={save} className="space-y-5 text-[11px]">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" className="peer sr-only" />
              <span className="h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-primary-600 peer-checked:after:translate-x-4" />
            </label>
            <span className="text-slate-500">Lançar esta cobrança em Conta Bancária com ID 8</span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_0.75fr_1.35fr_1fr]">
                <Select
                  label="Clientes"
                  value={form.clienteId}
                  onChange={(e) => {
                    setForm({ ...form, clienteId: e.target.value });
                    setOsSelecionadas([]);
                  }}
                >
                  <option value="">Selecione</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Conveniado"
                  value={form.convenio}
                  onChange={(e) => setForm({ ...form, convenio: e.target.value })}
                >
                  <option value="">Selecione</option>
                  <option>Particular</option>
                  <option>Convênio</option>
                </Select>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Pedido (data entrega)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <CampoDataBr
                      value={form.pedidoInicio}
                      onChange={(value) => setForm({ ...form, pedidoInicio: value })}
                    />
                    <CampoDataBr
                      value={form.pedidoFinal}
                      onChange={(value) => setForm({ ...form, pedidoFinal: value })}
                    />
                  </div>
                </div>
                <Select
                  label="Situação"
                  value={form.situacaoOs}
                  onChange={(e) => {
                    setForm({ ...form, situacaoOs: e.target.value });
                    setOsSelecionadas([]);
                  }}
                >
                  <option value="">Selecione</option>
                  {Object.entries(STATUS_TRABALHO).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                  <option value="produto">Produto</option>
                  <option value="transporte">Transporte</option>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  placeholder="OS, serviço ou paciente"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
                <Button type="button" size="sm" variant="secondary">
                  Limpar
                </Button>
              </div>

              <div className="min-h-28 rounded border border-slate-200 bg-slate-50/60 p-3">
                {!form.clienteId || !form.situacaoOs ? (
                  <p className="py-8 text-center text-slate-400">Selecione um cliente e uma situação para listar as OS.</p>
                ) : trabalhosParaReceita.length === 0 ? (
                  <p className="py-8 text-center text-slate-400">Nenhuma OS encontrada para este cliente e situação.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-2 py-2 text-left">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={todasReceitaSelecionadas}
                                ref={(el) => {
                                  if (el) {
                                    el.indeterminate =
                                      algumasReceitaSelecionadas && !todasReceitaSelecionadas;
                                  }
                                }}
                                onChange={toggleSelecionarTodasReceita}
                                className="h-4 w-4 accent-primary-600"
                                aria-label="Selecionar todas as OS"
                              />
                              <span>Selecionar</span>
                            </div>
                          </th>
                          <th className="px-2 py-2 text-left">OS</th>
                          <th className="px-2 py-2 text-left">Cliente</th>
                          <th className="px-2 py-2 text-left">Paciente</th>
                          <th className="px-2 py-2 text-left">Serviço</th>
                          <th className="px-2 py-2 text-left">Situação</th>
                          <th className="px-2 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {trabalhosParaReceita.map((trabalho) => (
                          <tr key={trabalho.id} className={osSelecionadas.includes(trabalho.id) ? "bg-blue-50" : "bg-white"}>
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={osSelecionadas.includes(trabalho.id)}
                                onChange={() => toggleOsReceita(trabalho.id)}
                                className="h-4 w-4 accent-primary-600"
                              />
                            </td>
                            <td className="px-2 py-2 font-semibold">{trabalho.numeroOs}</td>
                            <td className="px-2 py-2">{trabalho.cliente?.nome || "-"}</td>
                            <td className="px-2 py-2">{trabalho.paciente?.nome || "-"}</td>
                            <td className="px-2 py-2">{trabalho.tipoProtese}</td>
                            <td className="px-2 py-2">
                              <SituacaoOsBadgeReceita trabalho={trabalho} />
                            </td>
                            <td className="px-2 py-2 text-right">{money(valorTrabalho(trabalho))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-2 text-right text-xs font-semibold text-slate-700">
                      Total selecionado: {money(valorOsSelecionadas)}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-slate-600">
                  <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300" />
                  Alterar Situação para Entregue?
                </label>
                <label className="inline-flex items-center gap-2 text-slate-600">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                  Enviar Cadastro PagSeguro
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[auto_1fr]">
                <Button type="button" size="sm" variant="secondary">
                  add
                </Button>
                <Input placeholder="Código de barras" />
              </div>

              <div className="ml-auto w-full max-w-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-500">Valor Total</span>
                  <Input
                    value={currency(valorBruto)}
                    readOnly
                    className="h-8 max-w-32 text-right"
                  />
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-500">Desconto</span>
                  <div className="flex max-w-52 overflow-hidden rounded border border-slate-200">
                    <select
                      value={form.descontoTipo}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          descontoTipo: e.target.value,
                          desconto: e.target.value === "valor" ? "R$ 0,00" : "0,00",
                        })
                      }
                      className="w-14 border-r border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none"
                    >
                      <option value="percentual">%</option>
                      <option value="valor">R$</option>
                    </select>
                    <Input
                      selectOnFocus
                      value={form.desconto}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          desconto:
                            form.descontoTipo === "valor"
                              ? formatCurrencyInput(e.target.value)
                              : formatDecimalInput(e.target.value),
                        })
                      }
                      className="h-8 border-0 text-right shadow-none focus:ring-0"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 py-3 font-semibold text-primary-700">
                  <span>Total Líquido</span>
                  <span>{currency(totalLiquido)}</span>
                </div>
                {creditoAplicado > 0 && (
                  <>
                    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-emerald-700">
                      <span>Desconto com crédito</span>
                      <span>- {currency(creditoAplicado)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 font-semibold text-slate-800">
                      <span>Total a cobrar</span>
                      <span>{currency(totalAReceberComCredito)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="text-center text-slate-500">Escolha a(s) forma(s) de recebimento</div>
          {formaSelecionadaEhBoleto() ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-900">
              Com <strong>Boleto</strong>, o sistema emite automaticamente no Asaas ao cadastrar. O cliente
              precisa ter <strong>CPF ou CNPJ</strong> no cadastro. Configure a API em Configurações → Boletos.
            </p>
          ) : null}
          {mensagemLancamento ? (
            <p
              role="alert"
              className={cn(
                "rounded px-3 py-2 text-center text-[11px] font-medium",
                mensagemLancamentoTipo === "erro"
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-800"
              )}
            >
              {mensagemLancamento}
            </p>
          ) : null}

          <div className="rounded border border-primary-300 p-3">
            <Select
              label="Entrada"
              value={form.formaPagamento}
              onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })}
            >
              <option>Forma Pagamento</option>
              <option>Dinheiro</option>
              <option>Pix</option>
              <option>Cartão</option>
              <option>Boleto</option>
            </Select>

            <div className="mt-3 overflow-visible">
              <table className="w-full min-w-[900px] text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="px-2 py-2 text-left">Parcela</th>
                    <th className="px-2 py-2 text-left">Forma Recebimento</th>
                    <th className="px-2 py-2 text-left">Conta</th>
                    <th className="px-2 py-2 text-left">Vencimento</th>
                    <th className="px-2 py-2 text-left">Valor</th>
                    <th className="px-2 py-2 text-left">Juros (%)</th>
                    <th className="px-2 py-2 text-left">Acréscimo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-2 py-2">
                      <Input value={form.parcela} onChange={(e) => setForm({ ...form, parcela: e.target.value })} className="h-8" />
                    </td>
                    <td className="px-2 py-2">
                      <Select value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })}>
                        <option>Forma Pagamento</option>
                        <option>Dinheiro</option>
                        <option>Pix</option>
                        <option>Cartão</option>
                        <option>Boleto</option>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Select value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })}>
                        <option>Caixa Principal</option>
                        <option>Banco</option>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <CampoDataBr
                        value={form.vencimento}
                        onChange={(value) => setForm({ ...form, vencimento: value })}
                        calendarPosition="relative"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input value={currency(totalAReceberComCredito)} readOnly className="h-8 text-right" />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={form.juros}
                        onChange={(e) => setForm({ ...form, juros: formatDecimalInput(e.target.value) })}
                        className="h-8 text-right"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={form.acrescimo}
                        onChange={(e) => setForm({ ...form, acrescimo: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Button type="submit" className="w-full">
              Cadastrar
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        </form>
      </Modal>
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
