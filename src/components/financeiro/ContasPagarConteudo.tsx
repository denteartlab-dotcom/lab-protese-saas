"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  Filter,
  Flag,
  List,
  Eye,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  User,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Button, CampoDataBr, Select } from "@/components/ui";
import type { LancarReceitaPayload } from "@/components/financeiro/LancarReceitaModal";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { RelatorioDespesasModal } from "@/components/financeiro/RelatorioDespesasModal";
import { VisualizarDespesaModal } from "@/components/financeiro/VisualizarDespesaModal";
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
  classificarEntidadeDespesa,
  desempacotarDespesa,
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

const thClass =
  "border-b border-slate-200 bg-[#f5f6f8] px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500";

export function ContasPagarConteudo() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [entidadeAtiva, setEntidadeAtiva] = useState<EntidadeDespesa>("todos");
  const [tipoDespesa, setTipoDespesa] = useState("todas");
  const [erroLista, setErroLista] = useState("");
  const [periodo, setPeriodo] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFinal, setDataFinal] = useState("");
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
  const [despesaVisualizando, setDespesaVisualizando] = useState<{
    lancamento: Lancamento;
    ref: string;
  } | null>(null);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [fornecedores, setFornecedores] = useState<Array<{ id: string; nome: string }>>(
    []
  );

  const load = useCallback(async () => {
    setCarregando(true);
    setErroLista("");
    try {
      const res = await fetch(`/api/financeiro?tipo=despesa&_=${Date.now()}`, {
        cache: "no-store",
      });
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
    const atualizar = () => void load();
    window.addEventListener(FINANCEIRO_ATUALIZADO_EVENT, atualizar);
    window.addEventListener("focus", atualizar);
    return () => {
      window.removeEventListener(FINANCEIRO_ATUALIZADO_EVENT, atualizar);
      window.removeEventListener("focus", atualizar);
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
        const dataLanc = dateOnly(lancamento.data);
        if (inicio && dataLanc < inicio) return false;
        if (fim && dataLanc > fim) return false;

        if (entidadeAtiva !== "todos" && entidade !== entidadeAtiva) return false;

        if (tipoDespesa === "a_pagar" && lancamento.status !== "pendente") return false;
        if (tipoDespesa === "pagas" && lancamento.status !== "pago") return false;
        if (tipoDespesa === "atraso") {
          if (lancamento.status !== "pendente" || dataLanc >= hoje) return false;
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
    tipoDespesa,
    busca,
    listasNomes,
  ]);

  const linhasResumo = useMemo(() => {
    const inicio = dataInicio ? parseBrDate(dataInicio) : null;
    const fim = dataFinal ? parseBrDate(dataFinal) : null;
    if (inicio) inicio.setHours(0, 0, 0, 0);
    if (fim) fim.setHours(23, 59, 59, 999);

    return lancamentos.filter((lancamento) => {
      const dataLanc = dateOnly(lancamento.data);
      if (inicio && dataLanc < inicio) return false;
      if (fim && dataLanc > fim) return false;
      if (entidadeAtiva === "todos") return true;
      const pack = desempacotarDespesa(lancamento.descricao);
      const entidade =
        pack.meta.entidade ||
        classificarEntidadeDespesa(
          pack.nome,
          Boolean(lancamento.cliente?.id),
          listasNomes
        );
      return entidade === entidadeAtiva;
    });
  }, [lancamentos, dataInicio, dataFinal, entidadeAtiva, listasNomes]);

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
    aplicarPeriodo("todos");
    setTipoDespesa("a_pagar");
    setEntidadeAtiva("todos");
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
    const fornecedor =
      fornecedores.find((f) => f.id === payload.clienteId) ||
      fornecedores.find((f) => f.nome === payload.clienteId);
    const nomeEntidade = fornecedor?.nome || payload.clienteId || "Fornecedor";

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

    setSalvando(true);
    try {
      if (editando) {
        const parcela = payload.parcelas[0];
        const valor = Number(
          (parcela?.valor || "0").replace(/\./g, "").replace(",", ".")
        );
        const res = await fetch(`/api/financeiro/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descricao: descricaoBase,
            valor: valor || payload.totalLiquido,
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
        setTipoDespesa(parcela?.pago ? "pagas" : "a_pagar");
      } else {
        const totalParcelas = payload.parcelas.length;
        let numeroFatura: number | undefined;
        let salvos = 0;
        let temPago = false;
        let temPendente = false;
        for (let i = 0; i < payload.parcelas.length; i++) {
          const parcela = payload.parcelas[i];
          const valor = Number(
            parcela.valor.replace(/\./g, "").replace(",", ".")
          );
          if (!Number.isFinite(valor) || valor <= 0) continue;
          if (parcela.pago) temPago = true;
          else temPendente = true;
          const partes = parcela.parcela.split("/").map((x) => Number(x.trim()));
          const parcelaNumero = partes[0] || i + 1;
          const parcelaTotal = partes[1] || totalParcelas;
          const res = await fetch("/api/financeiro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo: "despesa",
              descricao: `${descricaoBase} (${parcela.parcela})`,
              valor,
              data: brShortToIso(parcela.vencimento || payload.dataLancamento),
              status: parcela.pago ? "pago" : "pendente",
              formaPagamento: parcela.formaPagamento || "Pix",
              parcelaNumero,
              parcelaTotal,
              numeroFatura,
            }),
          });
          const json = (await res.json().catch(() => ({}))) as {
            numeroFatura?: number;
            error?: string;
          };
          if (!res.ok) {
            alert(json.error || "Não foi possível salvar a despesa.");
            return;
          }
          salvos += 1;
          if (json.numeroFatura) numeroFatura = json.numeroFatura;
        }
        if (salvos === 0) {
          alert("Informe um valor maior que zero para salvar a despesa.");
          return;
        }
        if (temPago && !temPendente) setTipoDespesa("pagas");
        else if (temPendente && !temPago) setTipoDespesa("a_pagar");
        else setTipoDespesa("todas");
      }
      setModalAberto(false);
      setEditando(null);
      await load();
      notificarFinanceiroAtualizado();
    } finally {
      setSalvando(false);
    }
  }

  async function marcarPago(l: Lancamento) {
    await fetch(`/api/financeiro/${l.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pago" }),
    });
    await load();
  }

  async function confirmarExclusaoDespesa() {
    if (!despesaParaExcluir) return;
    await fetch(`/api/financeiro/${despesaParaExcluir.id}`, { method: "DELETE" });
    setDespesaParaExcluir(null);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-semibold text-slate-800">
                {money(resumo.aPagar)}
              </p>
              <p className="text-[11px] text-slate-500">A Pagar</p>
            </div>
            <span className="rounded-full bg-orange-50 p-2 text-orange-400">
              <Flag className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-semibold text-slate-800">
                {money(resumo.atraso)}
              </p>
              <p className="text-[11px] text-slate-500">Contas em Atraso</p>
            </div>
            <span className="rounded-full bg-rose-50 p-2 text-rose-500">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-semibold text-slate-800">
                {money(resumo.pagas)}
              </p>
              <p className="text-[11px] text-slate-500">Contas Pagas</p>
            </div>
            <span className="rounded-full bg-emerald-50 p-2 text-emerald-500">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
            title="Atualizar lista"
            onClick={() => void load()}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#4cae4c] text-white hover:bg-[#449d44]"
            title="Exportar"
          >
            <FileSpreadsheet className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-0 rounded border border-slate-200 bg-white shadow-sm">
          {abasEntidade.map((aba) => {
            const Icon = aba.icon;
            const ativa = entidadeAtiva === aba.id;
            return (
              <button
                key={aba.id}
                type="button"
                onClick={() => setEntidadeAtiva(aba.id)}
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

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[150px] shrink-0">
            <span className="mb-1 block h-5 text-[11px] font-medium leading-5 text-slate-600">
              Tipo Despesa
            </span>
            <select
              value={tipoDespesa}
              onChange={(e) => setTipoDespesa(e.target.value)}
              className="h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
            >
              <option value="a_pagar">A Pagar</option>
              <option value="pagas">Pagas</option>
              <option value="atraso">Em Atraso</option>
              <option value="todas">Todas</option>
            </select>
          </div>
          <div className="w-[140px] shrink-0">
            <span className="mb-1 block h-5 text-[11px] font-medium leading-5 text-slate-600">
              Período
            </span>
            <select
              value={periodo}
              onChange={(e) => aplicarPeriodo(e.target.value)}
              className="h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
            >
              <option value="hoje">Hoje</option>
              <option value="semana">Esta Semana</option>
              <option value="mes">Este Mês</option>
              <option value="todos">Mostrar Todos</option>
            </select>
          </div>
          <div className="flex shrink-0 items-end gap-2">
            <div className="w-[118px]">
              <span
                className="mb-1 block h-5 text-[11px] font-medium leading-5 text-transparent select-none"
                aria-hidden
              >
                Data
              </span>
              <CampoDataBr
                value={dataInicio}
                onChange={setDataInicio}
                onValueChange={() => setPeriodo("outro")}
                className="space-y-0"
                inputClassName="h-9 rounded border-slate-300 py-1.5 text-sm shadow-none"
              />
            </div>
            <div className="w-[118px]">
              <span
                className="mb-1 block h-5 text-[11px] font-medium leading-5 text-transparent select-none"
                aria-hidden
              >
                Data
              </span>
              <CampoDataBr
                value={dataFinal}
                onChange={setDataFinal}
                onValueChange={() => setPeriodo("outro")}
                className="space-y-0"
                inputClassName="h-9 rounded border-slate-300 py-1.5 text-sm shadow-none"
              />
            </div>
          </div>
          <div className="relative min-w-[200px] flex-1">
            <label className="mb-1 block h-5 text-[11px] font-medium leading-5 text-slate-600">
              Procurar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Procurar"
                className="h-9 w-full rounded border border-slate-300 bg-white pl-8 pr-16 text-sm outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
              />
              <button
                type="button"
                onClick={limparFiltros}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-normal text-[#4a90d9] hover:underline"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-[12px]">
            <thead>
              <tr>
                <th className={thClass}>Vencimento</th>
                <th className={`${thClass} w-14`}>Parc.</th>
                <th className={thClass}>Nome</th>
                <th className={thClass}>Referência</th>
                <th className={thClass}>Categoria</th>
                <th className={thClass}>Forma Pagamento</th>
                <th className={`${thClass} text-right`}>Valor</th>
                <th className={thClass}>Conta</th>
                <th className={`${thClass} text-center`}>Opções</th>
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
                linhas.map(({ lancamento, pack, ref }) => (
                  <tr
                    key={lancamento.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="px-3 py-2 text-slate-800">
                      {formatDate(lancamento.data)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{pack.parcela}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {lancamento.cliente?.nome || pack.nome}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{ref}</td>
                    <td className="px-3 py-2 text-slate-600">{pack.categoria}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {lancamento.formaPagamento || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                      {money(lancamento.valor)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{pack.conta}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {lancamento.status === "pendente" ? (
                          <button
                            type="button"
                            title="Marcar como pago"
                            onClick={() => void marcarPago(lancamento)}
                            className="rounded bg-[#4cae4c] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#449d44]"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="Visualizar"
                          onClick={() =>
                            setDespesaVisualizando({ lancamento, ref })
                          }
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-[#4a90d9]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => abrirEdicao(lancamento)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-[#4a90d9]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          onClick={() => setDespesaParaExcluir(lancamento)}
                          className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VisualizarDespesaModal
        open={!!despesaVisualizando}
        lancamento={despesaVisualizando?.lancamento ?? null}
        refOs={despesaVisualizando?.ref}
        onClose={() => setDespesaVisualizando(null)}
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
          anexosIniciais={
            editando ? desempacotarDespesa(editando.descricao).meta.anexos || [] : []
          }
        />
      ) : null}
    </div>
  );
}
