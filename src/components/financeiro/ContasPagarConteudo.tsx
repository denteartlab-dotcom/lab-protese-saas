"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { debounceCallback } from "@/lib/debounce-callback";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Filter,
  Eye,
  List,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  User,
  Users,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Button, CampoDataBr } from "@/components/ui";
import type { LancarReceitaPayload } from "@/components/financeiro/LancarReceitaModal";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { RelatorioDespesasModal } from "@/components/financeiro/RelatorioDespesasModal";
import { DespesaDetalheModal } from "@/components/financeiro/DespesaDetalheModal";
import { AdicionarImagensComprovanteModal } from "@/components/financeiro/AdicionarImagensComprovanteModal";
import { PagarDespesaModal } from "@/components/financeiro/PagarDespesaModal";
import { VisualizadorAnexoDespesa } from "@/components/financeiro/VisualizadorAnexoDespesa";
import {
  ANEXOS_FINANCEIRO_VAZIOS,
  type AnexoDespesa,
} from "@/lib/lancamento-despesa";
import {
  FINANCEIRO_ATUALIZADO_EVENT,
  notificarFinanceiroAtualizado,
} from "@/lib/financeiro-events";

const LancarDespesaModal = dynamic(
  () =>
    import("@/components/financeiro/LancarReceitaModal").then(
      (mod) => mod.LancarDespesaModal
    ),
  { ssr: false }
);
import { brShortToIso, dateToBrShort, parseBrDate } from "@/lib/datas-br";
import {
  carregarEntidadesDespesaLocal,
  chaveGrupoDespesa,
  classificarEntidadeDespesa,
  desempacotarDespesa,
  descricaoDespesaComParcela,
  empacotarDespesa,
  lerFornecedoresStorage,
  lerNomesStorage,
  type EntidadeDespesa,
  type DespesaMeta,
} from "@/lib/lancamento-despesa";
import { cn, formatDate } from "@/lib/utils";

type Lancamento = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome: string } | null;
  trabalho?: { id: string; numeroOs: number } | null;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

const abasEntidade: Array<{
  id: EntidadeDespesa;
  label: string;
  icon: typeof List;
}> = [
  { id: "todos", label: "Todos", icon: List },
  { id: "fornecedores", label: "Fornecedores", icon: ShoppingCart },
  { id: "colaboradores", label: "Colaboradores", icon: Users },
  { id: "prestadores", label: "Prestadores", icon: Filter },
  { id: "entregadores", label: "Entregadores", icon: Truck },
  { id: "clientes", label: "Clientes", icon: User },
];

const rotuloVinculoEntidade: Record<Exclude<EntidadeDespesa, "todos">, string> = {
  fornecedores: "Fornecedor",
  colaboradores: "Colaborador",
  prestadores: "Prestador",
  entregadores: "Entregador",
  clientes: "Cliente",
};

function despesaCorrespondeVinculo(
  lancamento: Lancamento,
  pack: { nome: string },
  vinculoId: string,
  opcoes: Array<{ id: string; nome: string }>
) {
  const opcao = opcoes.find((item) => item.id === vinculoId);
  if (!opcao) return true;
  if (lancamento.cliente?.id && lancamento.cliente.id === opcao.id) return true;
  const nomeLanc = (lancamento.cliente?.nome || pack.nome || "").trim().toLowerCase();
  return nomeLanc === opcao.nome.trim().toLowerCase();
}

const thClass =
  "border-b border-slate-200 bg-[#f5f6f8] py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500";

const tdVenc =
  "px-2 py-2 pl-3 text-left text-slate-800 whitespace-nowrap";
const tdParc = "px-1 py-2 text-left text-slate-700 whitespace-nowrap";
const tdNome = "px-2 py-2 text-left text-slate-800 truncate";
const tdRef = "px-2 py-2 text-left text-slate-600";
const tdCat = "px-3 py-2 text-left text-slate-600";
const tdForma = "px-2 py-2 text-left";
const tdValor = "px-2 py-2 text-right text-slate-800 whitespace-nowrap";
const tdConta = "px-2 py-2 text-left";
const tdOpc = "px-2 py-2 pr-3 text-right whitespace-nowrap";

const filtroLabelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const filtroInputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

type ColunaOrdenacaoDespesa =
  | "vencimento"
  | "parcela"
  | "nome"
  | "referencia"
  | "categoria"
  | "formaPagamento"
  | "valor"
  | "conta";

type DirecaoOrdenacao = "asc" | "desc";

type LinhaDespesa = {
  lancamento: Lancamento;
  pack: ReturnType<typeof desempacotarDespesa>;
  entidade: EntidadeDespesa;
  ref: string;
};

function numeroParcelaOrdenacao(pack: LinhaDespesa["pack"]) {
  const noTexto = pack.texto.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (noTexto) return Number(noTexto[1]) || 1;
  const total = Number.parseInt(pack.parcela, 10);
  return Number.isFinite(total) && total > 1 ? 1 : Number.parseInt(pack.parcela, 10) || 1;
}

function compararLinhasDespesa(
  a: LinhaDespesa,
  b: LinhaDespesa,
  coluna: ColunaOrdenacaoDespesa
) {
  switch (coluna) {
    case "vencimento":
      return dateOnly(a.lancamento.data).getTime() - dateOnly(b.lancamento.data).getTime();
    case "parcela":
      return numeroParcelaOrdenacao(a.pack) - numeroParcelaOrdenacao(b.pack);
    case "nome":
      return (a.lancamento.cliente?.nome || a.pack.nome).localeCompare(
        b.lancamento.cliente?.nome || b.pack.nome,
        "pt-BR"
      );
    case "referencia":
      return (a.ref || "").localeCompare(b.ref || "", "pt-BR");
    case "categoria":
      return a.pack.categoria.localeCompare(b.pack.categoria, "pt-BR");
    case "formaPagamento":
      return (a.lancamento.formaPagamento || "").localeCompare(
        b.lancamento.formaPagamento || "",
        "pt-BR"
      );
    case "valor":
      return a.lancamento.valor - b.lancamento.valor;
    case "conta":
      return a.pack.conta.localeCompare(b.pack.conta, "pt-BR");
    default:
      return 0;
  }
}

function ThOrdenavel({
  titulo,
  coluna,
  colunaAtiva,
  direcao,
  onOrdenar,
  alinhamento = "left",
}: {
  titulo: string;
  coluna: ColunaOrdenacaoDespesa;
  colunaAtiva: ColunaOrdenacaoDespesa;
  direcao: DirecaoOrdenacao;
  onOrdenar: (coluna: ColunaOrdenacaoDespesa) => void;
  alinhamento?: "left" | "right";
}) {
  const ativa = colunaAtiva === coluna;
  return (
    <button
      type="button"
      onClick={() => onOrdenar(coluna)}
      className={cn(
        "inline-flex w-full items-center gap-1 font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-700",
        alinhamento === "right" ? "justify-end" : "justify-start"
      )}
    >
      <span>{titulo}</span>
      <span className="inline-flex shrink-0 flex-col leading-none">
        <ChevronUp
          className={cn(
            "h-2.5 w-2.5",
            ativa && direcao === "asc" ? "text-slate-600" : "text-slate-300"
          )}
          strokeWidth={2.5}
        />
        <ChevronDown
          className={cn(
            "-mt-0.5 h-2.5 w-2.5",
            ativa && direcao === "desc" ? "text-slate-600" : "text-slate-300"
          )}
          strokeWidth={2.5}
        />
      </span>
    </button>
  );
}

function BadgePago() {
  return (
    <span className="inline-block whitespace-nowrap rounded bg-[#4cae4c] px-2.5 py-1 text-[11px] font-medium text-white">
      Pago
    </span>
  );
}

function exibirFormaPagamento(forma?: string | null) {
  const valor = forma?.trim();
  if (!valor) {
    return (
      <span className="inline-block whitespace-nowrap rounded bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
        Não Informado
      </span>
    );
  }
  return (
    <span className="inline-block whitespace-nowrap rounded bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
      {valor}
    </span>
  );
}

function exibirConta(conta?: string | null) {
  const valor = conta?.trim() && conta !== "—" ? conta : "Caixa Principal";
  return (
    <span className="inline-block whitespace-nowrap rounded bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-600">
      {valor}
    </span>
  );
}

function exibirParcela(pack: { parcela: string; texto: string }) {
  const noTexto = pack.texto.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (noTexto) return `${noTexto[1]} / ${noTexto[2]}`;
  const total = Number.parseInt(pack.parcela, 10);
  if (Number.isFinite(total) && total > 1) return `1 / ${total}`;
  return pack.parcela || "1";
}

export function ContasPagarConteudo() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [entidadeAtiva, setEntidadeAtiva] = useState<EntidadeDespesa>("todos");
  const [tipoDespesa, setTipoDespesa] = useState("a_pagar");
  const [colunaOrdenacao, setColunaOrdenacao] =
    useState<ColunaOrdenacaoDespesa>("vencimento");
  const [direcaoOrdenacao, setDirecaoOrdenacao] =
    useState<DirecaoOrdenacao>("asc");
  const [erroLista, setErroLista] = useState("");
  const [periodo, setPeriodo] = useState("mes");
  const [dataInicio, setDataInicio] = useState(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicio = new Date(hoje);
    inicio.setDate(1);
    return dateToBrShort(inicio);
  });
  const [dataFinal, setDataFinal] = useState(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fim = new Date(hoje);
    fim.setMonth(hoje.getMonth() + 1, 0);
    return dateToBrShort(fim);
  });
  const [busca, setBusca] = useState("");
  const [listasNomes, setListasNomes] = useState({
    fornecedores: [] as string[],
    colaboradores: [] as string[],
    prestadores: [] as string[],
    entregadores: [] as string[],
  });
  const [modalAberto, setModalAberto] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [despesaParaExcluir, setDespesaParaExcluir] = useState<Lancamento | null>(null);
  const [despesaAberta, setDespesaAberta] = useState<{
    lancamento: Lancamento;
    ref: string;
  } | null>(null);
  const [despesaPagar, setDespesaPagar] = useState<{
    lancamento: Lancamento;
    ref: string;
  } | null>(null);
  const [anexoAberto, setAnexoAberto] = useState<AnexoDespesa | null>(null);
  const [anexosAposPagamento, setAnexosAposPagamento] = useState<string[] | null>(
    null
  );
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [salvando, setSalvando] = useState(false);
  const salvarDespesaEmAndamentoRef = useRef(false);
  const [fornecedores, setFornecedores] = useState<Array<{ id: string; nome: string }>>(
    []
  );
  const [vinculoSelecionado, setVinculoSelecionado] = useState("");
  const [entidadesVinculo, setEntidadesVinculo] = useState<
    Array<{ id: string; nome: string }>
  >([]);

  const load = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!opts?.silencioso) {
      setCarregando(true);
      setErroLista("");
    }
    try {
      const res = await fetch("/api/financeiro?tipo=despesa");
      const json = (await res.json().catch(() => ({}))) as {
        lancamentos?: Lancamento[];
        error?: string;
      };
      if (!res.ok) {
        setLancamentos([]);
        setErroLista(json.error || "Não foi possível carregar as despesas.");
        return;
      }
      setLancamentos(
        Array.isArray(json.lancamentos)
          ? json.lancamentos.filter((l: Lancamento) => l.tipo === "despesa")
          : []
      );
    } catch {
      setLancamentos([]);
      setErroLista("Não foi possível carregar as despesas.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const { debounced: atualizar, cancel } = debounceCallback(
      () => void load({ silencioso: true }),
      320
    );
    window.addEventListener(FINANCEIRO_ATUALIZADO_EVENT, atualizar);
    return () => {
      cancel();
      window.removeEventListener(FINANCEIRO_ATUALIZADO_EVENT, atualizar);
    };
  }, [load]);

  useEffect(() => {
    setListasNomes({
      fornecedores: lerNomesStorage("labProteseFornecedores"),
      colaboradores: lerNomesStorage("labProteseColaboradores"),
      prestadores: lerNomesStorage("labProtesePrestadores"),
      entregadores: lerNomesStorage("labProteseEntregadores"),
    });
    setFornecedores(lerFornecedoresStorage());
    aplicarPeriodo("todos");
  }, []);

  useEffect(() => {
    setVinculoSelecionado("");
    if (entidadeAtiva === "todos") {
      setEntidadesVinculo([]);
      return;
    }

    let cancelado = false;

    async function carregarVinculos() {
      if (entidadeAtiva === "clientes") {
        try {
          const res = await fetch("/api/clientes");
          const data = await res.json();
          if (cancelado) return;
          const lista = Array.isArray(data)
            ? data
                .map((item: { id?: string; nome?: string }) => ({
                  id: String(item.id || ""),
                  nome: String(item.nome || "").trim(),
                }))
                .filter((item) => item.id && item.nome)
            : [];
          setEntidadesVinculo(
            lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
          );
        } catch {
          if (!cancelado) setEntidadesVinculo([]);
        }
        return;
      }

      if (
        entidadeAtiva === "fornecedores" ||
        entidadeAtiva === "colaboradores" ||
        entidadeAtiva === "prestadores" ||
        entidadeAtiva === "entregadores"
      ) {
        const lista = carregarEntidadesDespesaLocal(entidadeAtiva);
        if (!cancelado) setEntidadesVinculo(lista);
      }
    }

    void carregarVinculos();
    return () => {
      cancelado = true;
    };
  }, [entidadeAtiva]);

  function aplicarPeriodo(value: string) {
    setPeriodo(value);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (value === "todos") {
      setDataInicio("");
      setDataFinal("");
      return;
    }
    const inicio = new Date(hoje);
    const fim = new Date(hoje);
    if (value === "semana") {
      const dia = hoje.getDay();
      inicio.setDate(hoje.getDate() - dia);
      fim.setDate(inicio.getDate() + 6);
    } else if (value === "mes") {
      inicio.setDate(1);
      fim.setMonth(hoje.getMonth() + 1, 0);
    } else if (value === "hoje") {
      // inicio = fim = hoje
    } else {
      return;
    }
    setDataInicio(dateToBrShort(inicio));
    setDataFinal(dateToBrShort(fim));
  }

  const linhas = useMemo(() => {
    const inicio = dataInicio ? parseBrDate(dataInicio) : null;
    const fim = dataFinal ? parseBrDate(dataFinal) : null;
    if (inicio) inicio.setHours(0, 0, 0, 0);
    if (fim) fim.setHours(23, 59, 59, 999);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const termo = busca.trim().toLowerCase();

    return lancamentos
      .map((l) => {
        const pack = desempacotarDespesa(l.descricao);
        const entidade =
          pack.meta.entidade ||
          classificarEntidadeDespesa(
            pack.nome,
            Boolean(l.cliente?.id),
            listasNomes
          );
        const ref =
          l.trabalho?.numeroOs != null
            ? `OS ${l.trabalho.numeroOs}`
            : pack.referencia;
        return { lancamento: l, pack, entidade, ref };
      })
      .filter(({ lancamento, pack, entidade, ref }) => {
        const dataVencimento = dateOnly(lancamento.data);
        if (inicio && dataVencimento < inicio) return false;
        if (fim && dataVencimento > fim) return false;

        if (entidadeAtiva !== "todos" && entidade !== entidadeAtiva) return false;

        if (
          vinculoSelecionado &&
          !despesaCorrespondeVinculo(
            lancamento,
            pack,
            vinculoSelecionado,
            entidadesVinculo
          )
        ) {
          return false;
        }

        if (tipoDespesa === "a_pagar" && lancamento.status !== "pendente") return false;
        if (tipoDespesa === "pagas" && lancamento.status !== "pago") return false;
        if (tipoDespesa === "atraso") {
          if (lancamento.status !== "pendente" || dataVencimento >= hoje) return false;
        }

        if (!termo) return true;
        const blob = [
          pack.nome,
          ref,
          pack.categoria,
          lancamento.formaPagamento,
          pack.conta,
          lancamento.descricao,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(termo);
      });
  }, [
    lancamentos,
    dataInicio,
    dataFinal,
    entidadeAtiva,
    vinculoSelecionado,
    entidadesVinculo,
    tipoDespesa,
    busca,
    listasNomes,
  ]);

  const linhasOrdenadas = useMemo(() => {
    const copia = [...linhas];
    copia.sort((a, b) => {
      const diff = compararLinhasDespesa(a, b, colunaOrdenacao);
      return direcaoOrdenacao === "asc" ? diff : -diff;
    });
    return copia;
  }, [linhas, colunaOrdenacao, direcaoOrdenacao]);

  function alternarOrdenacao(coluna: ColunaOrdenacaoDespesa) {
    if (colunaOrdenacao === coluna) {
      setDirecaoOrdenacao((atual) => (atual === "asc" ? "desc" : "asc"));
      return;
    }
    setColunaOrdenacao(coluna);
    setDirecaoOrdenacao("asc");
  }

  const linhasResumo = useMemo(() => {
    const inicio = dataInicio ? parseBrDate(dataInicio) : null;
    const fim = dataFinal ? parseBrDate(dataFinal) : null;
    if (inicio) inicio.setHours(0, 0, 0, 0);
    if (fim) fim.setHours(23, 59, 59, 999);

    return lancamentos.filter((lancamento) => {
      const dataVencimento = dateOnly(lancamento.data);
      if (inicio && dataVencimento < inicio) return false;
      if (fim && dataVencimento > fim) return false;
      if (entidadeAtiva === "todos") return true;
      const pack = desempacotarDespesa(lancamento.descricao);
      const entidade =
        pack.meta.entidade ||
        classificarEntidadeDespesa(
          pack.nome,
          Boolean(lancamento.cliente?.id),
          listasNomes
        );
      if (entidade !== entidadeAtiva) return false;
      if (!vinculoSelecionado) return true;
      return despesaCorrespondeVinculo(
        lancamento,
        pack,
        vinculoSelecionado,
        entidadesVinculo
      );
    });
  }, [
    lancamentos,
    dataInicio,
    dataFinal,
    entidadeAtiva,
    vinculoSelecionado,
    entidadesVinculo,
    listasNomes,
  ]);

  const resumo = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let aPagar = 0;
    let atraso = 0;
    let pagas = 0;
    for (const lancamento of linhasResumo) {
      if (lancamento.status === "pago") {
        pagas += lancamento.valor;
      } else if (lancamento.status === "pendente") {
        aPagar += lancamento.valor;
        if (dateOnly(lancamento.data) < hoje) atraso += lancamento.valor;
      }
    }
    return { aPagar, atraso, pagas };
  }, [linhasResumo]);

  function limparFiltros() {
    setBusca("");
    setTipoDespesa("a_pagar");
    aplicarPeriodo("mes");
    setEntidadeAtiva("todos");
    setVinculoSelecionado("");
  }

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(l: Lancamento) {
    setEditando(l);
    setModalAberto(true);
  }

  async function salvarDespesaModal(payload: LancarReceitaPayload) {
    if (salvarDespesaEmAndamentoRef.current) return;
    salvarDespesaEmAndamentoRef.current = true;
    setSalvando(true);
    const nomeEntidade = payload.entidadeNome || payload.clienteId || "Fornecedor";

    const descricaoItens = payload.itens
      .map((item) => [item.produto, item.descricao].filter(Boolean).join(" - "))
      .filter(Boolean)
      .join("; ");
    const meta: DespesaMeta = {
      entidade: payload.tipoCliente as EntidadeDespesa,
      categoria: payload.categoria,
      conta: payload.parcelas[0]?.conta || "Caixa Principal",
      parcela: String(payload.parcelas.length),
      referencia: payload.notaFiscalRef,
      nome: nomeEntidade,
      ...(payload.anexos?.length ? { anexos: payload.anexos } : {}),
    };
    const descricaoBase = empacotarDespesa(
      [descricaoItens, payload.observacoes].filter(Boolean).join(" | ") ||
        nomeEntidade,
      meta
    );

    try {
      if (editando) {
        const chave = chaveGrupoDespesa(editando.descricao);
        const irmaos = lancamentos.filter(
          (item) =>
            item.id !== editando.id &&
            chaveGrupoDespesa(item.descricao) === chave
        );
        const registrosGrupo = [editando, ...irmaos].sort((a, b) => {
          const pa = desempacotarDespesa(a.descricao).texto.match(
            /\((\d+)\s*\/\s*(\d+)\)/
          );
          const pb = desempacotarDespesa(b.descricao).texto.match(
            /\((\d+)\s*\/\s*(\d+)\)/
          );
          return (Number(pa?.[1]) || 1) - (Number(pb?.[1]) || 1);
        });
        const alvos =
          registrosGrupo.length > 1
            ? registrosGrupo
            : [editando];

        for (let i = 0; i < payload.parcelas.length; i++) {
          const parcela = payload.parcelas[i];
          const alvo = alvos[i] ?? alvos[0];
          if (!alvo) continue;
          const valor = Number(
            (parcela?.valor || "0").replace(/\./g, "").replace(",", ".")
          );
          const res = await fetch(`/api/financeiro/${alvo.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              descricao: descricaoDespesaComParcela(
                descricaoBase,
                parcela.parcela
              ),
              valor: valor || payload.totalLiquido / payload.parcelas.length,
              data: brShortToIso(parcela?.vencimento || payload.dataLancamento),
              status: parcela?.pago ? "pago" : "pendente",
              formaPagamento: parcela?.formaPagamento || "Pix",
            }),
          });
          if (!res.ok) {
            const json = (await res.json().catch(() => ({}))) as { error?: string };
            alert(json.error || "Não foi possível salvar a despesa.");
            return;
          }
        }

        const temPago = payload.parcelas.some((p) => p.pago);
        const temPendente = payload.parcelas.some((p) => !p.pago);
        if (temPago && !temPendente) setTipoDespesa("pagas");
        else if (temPendente && !temPago) setTipoDespesa("a_pagar");
        else setTipoDespesa("todas");
      } else {
        const parcelasApi = payload.parcelas
          .map((parcela) => {
            const valor = Number(
              parcela.valor.replace(/\./g, "").replace(",", ".")
            );
            if (!Number.isFinite(valor) || valor <= 0) return null;
            return {
              valor,
              data: brShortToIso(parcela.vencimento || payload.dataLancamento),
              status: (parcela.pago ? "pago" : "pendente") as "pago" | "pendente",
              formaPagamento: parcela.formaPagamento || "Pix",
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);

        if (parcelasApi.length === 0) {
          alert("Informe um valor maior que zero para salvar a despesa.");
          return;
        }

        const temPago = parcelasApi.some((p) => p.status === "pago");
        const temPendente = parcelasApi.some((p) => p.status === "pendente");

        if (parcelasApi.length === 1) {
          const parcela = payload.parcelas[0];
          const partes = parcela.parcela.split("/").map((x) => Number(x.trim()));
          const res = await fetch("/api/financeiro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo: "despesa",
              descricao: descricaoDespesaComParcela(descricaoBase, parcela.parcela),
              valor: parcelasApi[0].valor,
              data: parcelasApi[0].data,
              status: parcelasApi[0].status,
              formaPagamento: parcelasApi[0].formaPagamento,
              parcelaNumero: partes[0] || 1,
              parcelaTotal: partes[1] || 1,
            }),
          });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            alert(json.error || "Não foi possível salvar a despesa.");
            return;
          }
        } else {
          const res = await fetch("/api/financeiro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo: "despesa",
              descricao: descricaoBase,
              valor: parcelasApi[0].valor,
              parcelas: parcelasApi,
            }),
          });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            alert(json.error || "Não foi possível salvar a despesa.");
            return;
          }
        }

        if (temPago && !temPendente) setTipoDespesa("pagas");
        else if (temPendente && !temPago) setTipoDespesa("a_pagar");
        else setTipoDespesa("todas");
      }
      setModalAberto(false);
      setEditando(null);
      notificarFinanceiroAtualizado();
    } finally {
      salvarDespesaEmAndamentoRef.current = false;
      setSalvando(false);
    }
  }

  async function confirmarExclusaoDespesa() {
    if (!despesaParaExcluir) return;
    const id = despesaParaExcluir.id;
    setLancamentos((lista) => lista.filter((item) => item.id !== id));
    setDespesaParaExcluir(null);
    await fetch(`/api/financeiro/${id}`, { method: "DELETE" });
    notificarFinanceiroAtualizado();
  }

  return (
    <div className="space-y-3 text-[11px] text-slate-700">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-semibold text-slate-800">
                {money(resumo.aPagar)}
              </p>
              <p className="text-[11px] text-slate-500">A Pagar</p>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-orange-400 text-xs font-bold text-white">
              P
            </span>
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-semibold text-slate-800">
                {money(resumo.atraso)}
              </p>
              <p className="text-[11px] text-slate-500">
                Contas em Atraso{" "}
                <button
                  type="button"
                  onClick={() => setTipoDespesa("atraso")}
                  className="rounded bg-[#4a90d9] px-1.5 py-0.5 text-[9px] font-normal text-white hover:bg-[#3b7bc4]"
                >
                  Ver
                </button>
              </p>
            </div>
            <span className="rounded-full bg-rose-50 p-2 text-rose-500">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-semibold text-slate-800">
                {money(resumo.pagas)}
              </p>
              <p className="text-[11px] text-slate-500">Contas Pagas</p>
            </div>
            <span className="rounded-full bg-emerald-50 p-2 text-emerald-500">
              <Check className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="inline-flex items-center gap-1.5 rounded bg-[#4cae4c] px-4 py-2 text-[13px] font-normal text-white hover:bg-[#449d44]"
              onClick={abrirNovo}
            >
              <Plus className="h-4 w-4" />
              Lançar Despesa
            </Button>
            <Button
              size="sm"
              className="inline-flex items-center gap-1.5 rounded bg-[#4a90d9] px-4 py-2 text-[13px] font-normal text-white hover:bg-[#3d7fc4]"
              onClick={() => setRelatorioAberto(true)}
            >
              <Printer className="h-4 w-4" />
              Relatório
            </Button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#4a90d9] text-white hover:bg-[#3d7fc4]"
              title="Imprimir"
              onClick={() => setRelatorioAberto(true)}
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#4cae4c] text-white hover:bg-[#449d44]"
              title="Exportar"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </button>
          </div>

          <div className="flex shrink-0 flex-wrap gap-0 rounded border border-slate-200 bg-white">
            {abasEntidade.map((aba) => {
              const Icon = aba.icon;
              const ativa = entidadeAtiva === aba.id;
              return (
                <button
                  key={aba.id}
                  type="button"
                  onClick={() => {
                    setEntidadeAtiva(aba.id);
                    setVinculoSelecionado("");
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-r border-slate-200 px-3 py-2 text-[12px] font-normal transition last:border-r-0",
                    ativa
                      ? "bg-[#4a90d9] text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {aba.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-b border-slate-200 px-3 py-3">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="w-[140px] shrink-0">
              <span className={filtroLabelClass}>Tipo Despesa</span>
              <div className="relative">
                <select
                  value={tipoDespesa}
                  onChange={(e) => setTipoDespesa(e.target.value)}
                  className={cn(filtroInputClass, "appearance-none pr-8 text-[12px]")}
                >
                  <option value="a_pagar">A Pagar</option>
                  <option value="pagas">Pagas</option>
                  <option value="atraso">Em Atraso</option>
                  <option value="todas">Todas</option>
                </select>
                {tipoDespesa !== "todas" ? (
                  <button
                    type="button"
                    onClick={() => setTipoDespesa("todas")}
                    className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Limpar filtro"
                    aria-label="Limpar tipo despesa"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                  ▾
                </span>
              </div>
            </div>

            {entidadeAtiva !== "todos" ? (
              <div className="w-[155px] shrink-0">
                <span className={filtroLabelClass}>
                  {rotuloVinculoEntidade[entidadeAtiva]}
                </span>
                <div className="relative">
                  <select
                    value={vinculoSelecionado}
                    onChange={(e) => setVinculoSelecionado(e.target.value)}
                    className={cn(filtroInputClass, "appearance-none pr-6 text-[12px]")}
                  >
                    <option value="" />
                    {entidadesVinculo.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                    ▾
                  </span>
                </div>
              </div>
            ) : null}

            <div className="shrink-0">
              <span className={filtroLabelClass}>Período</span>
              <div className="flex items-center gap-1.5">
                <select
                  value={periodo}
                  onChange={(e) => aplicarPeriodo(e.target.value)}
                  className={cn(filtroInputClass, "w-[118px] shrink-0 text-[12px]")}
                >
                  <option value="hoje">Hoje</option>
                  <option value="semana">Esta Semana</option>
                  <option value="mes">Este Mês</option>
                  <option value="todos">Mostrar Todos</option>
                  <option value="outro">Outro Período</option>
                </select>
                <div className="w-[108px] shrink-0">
                  <CampoDataBr
                    value={dataInicio}
                    onChange={setDataInicio}
                    onValueChange={() => setPeriodo("outro")}
                    placeholder="dd/mm/aa"
                    iconPosition="left"
                    className="space-y-0"
                    inputClassName="h-9 w-full rounded border border-slate-300 bg-white pl-8 pr-2 text-[12px] text-slate-800 shadow-none outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
                  />
                </div>
                <div className="w-[108px] shrink-0">
                  <CampoDataBr
                    value={dataFinal}
                    onChange={setDataFinal}
                    onValueChange={() => setPeriodo("outro")}
                    placeholder="dd/mm/aa"
                    iconPosition="left"
                    className="space-y-0"
                    inputClassName="h-9 w-full rounded border border-slate-300 bg-white pl-8 pr-2 text-[12px] text-slate-800 shadow-none outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
                  />
                </div>
              </div>
            </div>

            <div className="min-w-[220px] flex-1">
              <span className={cn(filtroLabelClass, "inline-flex items-center gap-1")}>
                <Search className="h-3 w-3 text-slate-500" />
                Procurar
              </span>
              <div className="relative">
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Procurar"
                  className="h-9 w-full rounded border border-slate-300 bg-white py-1 pl-2.5 pr-[72px] text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
                />
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute right-0 top-0 h-9 rounded-r border border-l-0 border-slate-300 bg-slate-500 px-4 text-[11px] font-semibold text-white hover:bg-slate-600"
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-[12px]">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[5%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[27%]" />
              <col className="w-[13%]" />
              <col className="w-[7%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={cn(thClass, "pl-3 pr-2")}>
                  <ThOrdenavel
                    titulo={tipoDespesa === "pagas" ? "Pagamento" : "Vencimento"}
                    coluna="vencimento"
                    colunaAtiva={colunaOrdenacao}
                    direcao={direcaoOrdenacao}
                    onOrdenar={alternarOrdenacao}
                  />
                </th>
                <th className={cn(thClass, "px-1")}>
                  <ThOrdenavel
                    titulo="Parc."
                    coluna="parcela"
                    colunaAtiva={colunaOrdenacao}
                    direcao={direcaoOrdenacao}
                    onOrdenar={alternarOrdenacao}
                  />
                </th>
                <th className={cn(thClass, "px-2")}>
                  <ThOrdenavel
                    titulo="Nome"
                    coluna="nome"
                    colunaAtiva={colunaOrdenacao}
                    direcao={direcaoOrdenacao}
                    onOrdenar={alternarOrdenacao}
                  />
                </th>
                <th className={cn(thClass, "px-2")}>
                  <ThOrdenavel
                    titulo="Referencia"
                    coluna="referencia"
                    colunaAtiva={colunaOrdenacao}
                    direcao={direcaoOrdenacao}
                    onOrdenar={alternarOrdenacao}
                  />
                </th>
                <th className={cn(thClass, "px-3")}>
                  <ThOrdenavel
                    titulo="Categoria"
                    coluna="categoria"
                    colunaAtiva={colunaOrdenacao}
                    direcao={direcaoOrdenacao}
                    onOrdenar={alternarOrdenacao}
                  />
                </th>
                <th className={cn(thClass, "px-2")}>
                  <ThOrdenavel
                    titulo="Forma Pagamento"
                    coluna="formaPagamento"
                    colunaAtiva={colunaOrdenacao}
                    direcao={direcaoOrdenacao}
                    onOrdenar={alternarOrdenacao}
                  />
                </th>
                <th className={cn(thClass, "px-2 text-right")}>
                  <ThOrdenavel
                    titulo="Valor"
                    coluna="valor"
                    colunaAtiva={colunaOrdenacao}
                    direcao={direcaoOrdenacao}
                    onOrdenar={alternarOrdenacao}
                    alinhamento="right"
                  />
                </th>
                <th className={cn(thClass, "px-2")}>
                  <ThOrdenavel
                    titulo="Conta"
                    coluna="conta"
                    colunaAtiva={colunaOrdenacao}
                    direcao={direcaoOrdenacao}
                    onOrdenar={alternarOrdenacao}
                  />
                </th>
                <th className={cn(thClass, "px-2 pr-3 text-right")}>Opções</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-slate-400">
                    Carregando…
                  </td>
                </tr>
              ) : linhas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-slate-500">
                    {erroLista ? (
                      <span className="text-red-600">{erroLista}</span>
                    ) : lancamentos.length > 0 ? (
                      <>
                        Nenhuma despesa com os filtros atuais.
                        <br />
                        <span className="text-[11px] text-slate-400">
                          Você tem {lancamentos.length} despesa(s) salva(s). Tente
                          &quot;Todas&quot; ou &quot;Pagas&quot; se marcou como pago.
                        </span>
                      </>
                    ) : (
                      "Nenhuma despesa encontrada."
                    )}
                  </td>
                </tr>
              ) : (
                linhasOrdenadas.map(({ lancamento, pack, ref }) => {
                  const aberta = despesaAberta?.lancamento.id === lancamento.id;
                  return (
                    <tr
                      key={lancamento.id}
                      className={cn(
                        "border-b border-slate-100 hover:bg-slate-50/80",
                        aberta && "bg-slate-50"
                      )}
                    >
                        <td className={tdVenc}>{formatDate(lancamento.data)}</td>
                        <td className={tdParc}>{exibirParcela(pack)}</td>
                        <td className={tdNome} title={lancamento.cliente?.nome || pack.nome}>
                          {lancamento.cliente?.nome || pack.nome}
                        </td>
                        <td className={tdRef}>{ref?.trim() || ""}</td>
                        <td className={tdCat}>{pack.categoria}</td>
                        <td className={tdForma}>
                          {exibirFormaPagamento(lancamento.formaPagamento)}
                        </td>
                        <td className={tdValor}>{money(lancamento.valor)}</td>
                        <td className={tdConta}>{exibirConta(pack.conta)}</td>
                        <td className={tdOpc}>
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {lancamento.status === "pago" ? (
                              <BadgePago />
                            ) : (
                              <button
                                type="button"
                                title="Marcar como pago"
                                onClick={() =>
                                  setDespesaPagar({ lancamento, ref })
                                }
                                className="rounded bg-[#4a90d9] px-3 py-1 text-[11px] font-normal text-white hover:bg-[#3d7fc4]"
                              >
                                Pagar
                              </button>
                            )}
                            <button
                              type="button"
                              title="Ver detalhes"
                              onClick={() =>
                                setDespesaAberta({ lancamento, ref })
                              }
                              className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                            >
                              <Eye className="h-4 w-4 stroke-[1.5]" />
                            </button>
                            <button
                              type="button"
                              title="Editar"
                              onClick={() => abrirEdicao(lancamento)}
                              className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                            >
                              <Pencil className="h-4 w-4 stroke-[1.5]" />
                            </button>
                            <button
                              type="button"
                              title="Excluir"
                              onClick={() => setDespesaParaExcluir(lancamento)}
                              className="rounded p-0.5 text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 stroke-[1.5]" />
                            </button>
                          </div>
                        </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VisualizadorAnexoDespesa anexo={anexoAberto} onClose={() => setAnexoAberto(null)} />

      <PagarDespesaModal
        open={!!despesaPagar}
        lancamento={despesaPagar?.lancamento ?? null}
        refOs={despesaPagar?.ref}
        todosLancamentos={lancamentos}
        onClose={() => setDespesaPagar(null)}
        onConfirmado={(detail) => {
          setDespesaPagar(null);
          notificarFinanceiroAtualizado();
          if (detail?.anexarComprovante && detail.lancamentoIds?.length) {
            setAnexosAposPagamento(detail.lancamentoIds);
          }
        }}
      />

      <AdicionarImagensComprovanteModal
        open={!!anexosAposPagamento?.length}
        lancamentoIds={anexosAposPagamento ?? []}
        lancamentos={lancamentos}
        onClose={() => setAnexosAposPagamento(null)}
        onSalvo={() => {
          setAnexosAposPagamento(null);
          notificarFinanceiroAtualizado();
        }}
      />

      <DespesaDetalheModal
        open={!!despesaAberta}
        lancamento={despesaAberta?.lancamento ?? null}
        refOs={despesaAberta?.ref}
        onClose={() => setDespesaAberta(null)}
        onEditar={() => {
          if (!despesaAberta?.lancamento) return;
          setDespesaAberta(null);
          abrirEdicao(despesaAberta.lancamento);
        }}
        onAnexoClick={setAnexoAberto}
      />

      <ConfirmacaoExclusaoModal
        open={!!despesaParaExcluir}
        titulo="Excluir Despesa"
        mensagem="Deseja realmente excluir essa despesa?"
        detalhe={
          despesaParaExcluir
            ? desempacotarDespesa(despesaParaExcluir.descricao).nome
            : undefined
        }
        onClose={() => setDespesaParaExcluir(null)}
        onConfirm={confirmarExclusaoDespesa}
      />

      <RelatorioDespesasModal
        open={relatorioAberto}
        onClose={() => setRelatorioAberto(false)}
        lancamentos={lancamentos}
      />

      {modalAberto ? (
        <LancarDespesaModal
          key={editando ? `edit-${editando.id}` : "novo-despesa-smart"}
          open={modalAberto}
          onClose={() => {
            setModalAberto(false);
            setEditando(null);
          }}
          onSubmit={salvarDespesaModal}
          entidades={fornecedores}
          salvando={salvando}
          tituloEdicao={editando ? "Editar Despesa" : undefined}
          lancamentoEdicao={editando}
          todosLancamentosEdicao={lancamentos}
          anexosIniciais={
            editando
              ? desempacotarDespesa(editando.descricao).meta.anexos ||
                ANEXOS_FINANCEIRO_VAZIOS
              : ANEXOS_FINANCEIRO_VAZIOS
          }
        />
      ) : null}
    </div>
  );
}
