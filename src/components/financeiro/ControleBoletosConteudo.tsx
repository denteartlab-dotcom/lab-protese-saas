"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Pencil,
  Plus,
  Search,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CampoDataBr, Button } from "@/components/ui";
import { FinanceiroAbasNav } from "@/components/financeiro/FinanceiroAbasNav";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { AdicionarImagensComprovanteModal } from "@/components/financeiro/AdicionarImagensComprovanteModal";
import { DespesaDetalheModal } from "@/components/financeiro/DespesaDetalheModal";
import { PagarDespesaModal } from "@/components/financeiro/PagarDespesaModal";
import { VisualizadorAnexoDespesa } from "@/components/financeiro/VisualizadorAnexoDespesa";
import type { LancarReceitaPayload } from "@/components/financeiro/LancarReceitaModal";
import {
  ANEXOS_FINANCEIRO_VAZIOS,
  type AnexoDespesa,
  type DespesaMeta,
  type EntidadeDespesa,
} from "@/lib/lancamento-despesa";
import {
  alertasBoletos,
  calcularResumoBoletos,
  dataEmissaoBoleto,
  dateOnlyBoleto,
  filtrarLinhasBoletos,
  formatarMoedaBoleto,
  graficoBoletosPorMes,
  labelStatusBoleto,
  ordenarLinhasBoletos,
  type ColunaOrdenacaoBoleto,
  type DirecaoOrdenacaoBoleto,
  type FiltroStatusBoleto,
  type GrupoBoletoTabela,
  type LancamentoBoletoResumo,
  type LinhaBoleto,
} from "@/lib/controle-boletos";
import { brShortToIso, dateToBrShort } from "@/lib/datas-br";
import {
  FINANCEIRO_ATUALIZADO_EVENT,
  notificarFinanceiroAtualizado,
} from "@/lib/financeiro-events";
import {
  desempacotarDespesa,
  descricaoDespesaComParcela,
  empacotarDespesa,
  lerFornecedoresStorage,
} from "@/lib/lancamento-despesa";
import { debounceCallback } from "@/lib/debounce-callback";
import { cn, formatDate } from "@/lib/utils";

const LancarDespesaModal = dynamic(
  () =>
    import("@/components/financeiro/LancarReceitaModal").then(
      (mod) => mod.LancarDespesaModal
    ),
  { ssr: false }
);

function CardKpi({
  titulo,
  quantidade,
  valor,
  subtitulo,
  corBorda,
  icone: Icone,
}: {
  titulo: string;
  quantidade: number;
  valor: number;
  subtitulo?: string;
  corBorda: string;
  icone: typeof Wallet;
}) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      style={{ borderTopWidth: 3, borderTopColor: corBorda }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {titulo}
          </p>
          <p className="mt-2 text-[28px] font-bold tabular-nums text-slate-900">
            {quantidade}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-slate-700">
            {formatarMoedaBoleto(valor)}
          </p>
          {subtitulo ? (
            <p className="mt-1 text-[11px] text-slate-400">{subtitulo}</p>
          ) : null}
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${corBorda}18` }}
        >
          <Icone className="h-4 w-4" style={{ color: corBorda }} />
        </div>
      </div>
    </div>
  );
}

function BadgeStatus({ linha }: { linha: LinhaBoleto }) {
  const label = labelStatusBoleto(linha);
  const cls =
    linha.lancamento.status === "pago"
      ? "bg-emerald-100 text-emerald-700"
      : linha.grupo === "vencidos"
        ? "bg-red-100 text-red-700"
        : linha.emAnalise
          ? "bg-amber-100 text-amber-800"
          : "bg-sky-100 text-sky-700";
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cls)}>
      {label}
    </span>
  );
}

const rotuloGrupo: Record<
  GrupoBoletoTabela,
  { titulo: string; cor: string; bg: string }
> = {
  vencidos: {
    titulo: "Vencidos",
    cor: "text-red-700",
    bg: "bg-red-50 border-red-100",
  },
  proximos: {
    titulo: "Próximos do vencimento",
    cor: "text-amber-800",
    bg: "bg-amber-50 border-amber-100",
  },
  pagos: {
    titulo: "Pagos",
    cor: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-100",
  },
};

function CabecalhoGrupo({
  grupo,
  linhas,
}: {
  grupo: GrupoBoletoTabela;
  linhas: LinhaBoleto[];
}) {
  if (linhas.length === 0) return null;
  const total = linhas.reduce((s, l) => s + l.lancamento.valor, 0);
  const meta = rotuloGrupo[grupo];
  return (
    <tr>
      <td
        colSpan={7}
        className={cn(
          "border-y px-4 py-2 text-[11px] font-bold uppercase tracking-wide",
          meta.bg,
          meta.cor
        )}
      >
        {meta.titulo} — {linhas.length} boleto(s) — {formatarMoedaBoleto(total)}
      </td>
    </tr>
  );
}

function ThOrdenavelBoleto({
  titulo,
  coluna,
  colunaAtiva,
  direcao,
  onOrdenar,
  alinhamento = "left",
}: {
  titulo: string;
  coluna: ColunaOrdenacaoBoleto;
  colunaAtiva: ColunaOrdenacaoBoleto;
  direcao: DirecaoOrdenacaoBoleto;
  onOrdenar: (coluna: ColunaOrdenacaoBoleto) => void;
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

function LinhaTabela({
  linha,
  onVer,
  onPagar,
  onEditar,
}: {
  linha: LinhaBoleto;
  onVer: () => void;
  onPagar: () => void;
  onEditar: () => void;
}) {
  const venc = dateOnlyBoleto(linha.lancamento.data);
  const emissao = dataEmissaoBoleto(linha.lancamento);
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/80">
      <td className="px-4 py-3">
        <p className="text-[13px] font-semibold text-slate-900">{linha.fornecedor}</p>
        {linha.ref !== "—" ? (
          <p className="text-[11px] text-slate-500">{linha.ref}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-[12px] text-slate-600">{linha.categoria}</td>
      <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-slate-900">
        {formatarMoedaBoleto(linha.lancamento.valor)}
      </td>
      <td className="px-4 py-3 text-[12px] text-slate-600 whitespace-nowrap">
        {formatDate(emissao)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-[12px] text-slate-800">{formatDate(venc)}</p>
        {linha.lancamento.status === "pendente" ? (
          <p
            className={cn(
              "text-[10px]",
              linha.grupo === "vencidos" ? "text-red-600" : "text-slate-400"
            )}
          >
            {linha.grupo === "vencidos"
              ? `${Math.abs(linha.diasAteVencimento)} dia(s) em atraso`
              : linha.diasAteVencimento === 0
                ? "Vence hoje"
                : `Em ${linha.diasAteVencimento} dia(s)`}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <BadgeStatus linha={linha} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={onVer}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
          >
            Ver
          </button>
          {linha.lancamento.status === "pendente" ? (
            <button
              type="button"
              onClick={onPagar}
              className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
            >
              Pagar
            </button>
          ) : null}
          <button
            type="button"
            onClick={onEditar}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ControleBoletosConteudo() {
  const [lancamentos, setLancamentos] = useState<LancamentoBoletoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusBoleto>("todos");
  const [colunaOrdenacao, setColunaOrdenacao] =
    useState<ColunaOrdenacaoBoleto>("vencimento");
  const [direcaoOrdenacao, setDirecaoOrdenacao] =
    useState<DirecaoOrdenacaoBoleto>("asc");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<LancamentoBoletoResumo | null>(null);
  const [salvando, setSalvando] = useState(false);
  const salvarRef = useRef(false);
  const [fornecedores, setFornecedores] = useState<Array<{ id: string; nome: string }>>([]);
  const [despesaAberta, setDespesaAberta] = useState<{
    lancamento: LancamentoBoletoResumo;
    ref: string;
  } | null>(null);
  const [despesaPagar, setDespesaPagar] = useState<{
    lancamento: LancamentoBoletoResumo;
    ref: string;
  } | null>(null);
  const [despesaExcluir, setDespesaExcluir] = useState<LancamentoBoletoResumo | null>(
    null
  );
  const [anexoAberto, setAnexoAberto] = useState<AnexoDespesa | null>(null);
  const [anexosAposPagamento, setAnexosAposPagamento] = useState<string[] | null>(
    null
  );

  const load = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!opts?.silencioso) {
      setCarregando(true);
      setErroLista("");
    }
    try {
      const res = await fetch("/api/financeiro?tipo=despesa");
      const json = (await res.json().catch(() => ({}))) as {
        lancamentos?: LancamentoBoletoResumo[];
        error?: string;
      };
      if (!res.ok) {
        setLancamentos([]);
        setErroLista(json.error || "Não foi possível carregar os boletos.");
        return;
      }
      setLancamentos(
        Array.isArray(json.lancamentos)
          ? json.lancamentos.filter(
              (l) => l.tipo === "despesa" && l.status !== "cancelado"
            )
          : []
      );
    } catch {
      setLancamentos([]);
      setErroLista("Não foi possível carregar os boletos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void load();
    setFornecedores(lerFornecedoresStorage());
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

  const linhasFiltradas = useMemo(
    () =>
      filtrarLinhasBoletos(lancamentos, {
        busca,
        dataInicio,
        dataFim,
        status: filtroStatus,
      }),
    [lancamentos, busca, dataInicio, dataFim, filtroStatus]
  );

  const linhasOrdenadas = useMemo(
    () => ordenarLinhasBoletos(linhasFiltradas, colunaOrdenacao, direcaoOrdenacao),
    [linhasFiltradas, colunaOrdenacao, direcaoOrdenacao]
  );

  function alternarOrdenacao(coluna: ColunaOrdenacaoBoleto) {
    if (colunaOrdenacao === coluna) {
      setDirecaoOrdenacao((atual) => (atual === "asc" ? "desc" : "asc"));
      return;
    }
    setColunaOrdenacao(coluna);
    setDirecaoOrdenacao("asc");
  }

  const linhasResumo = useMemo(
    () => filtrarLinhasBoletos(lancamentos, { dataInicio, dataFim }),
    [lancamentos, dataInicio, dataFim]
  );

  const resumo = useMemo(() => calcularResumoBoletos(linhasResumo), [linhasResumo]);
  const alertas = useMemo(() => alertasBoletos(linhasResumo), [linhasResumo]);
  const grafico = useMemo(() => graficoBoletosPorMes(linhasResumo), [linhasResumo]);

  const grupos = useMemo(() => {
    const vencidos = linhasOrdenadas.filter((l) => l.grupo === "vencidos");
    const proximos = linhasOrdenadas.filter((l) => l.grupo === "proximos");
    const pagos = linhasOrdenadas.filter((l) => l.grupo === "pagos");
    return { vencidos, proximos, pagos };
  }, [linhasOrdenadas]);

  async function salvarDespesaModal(payload: LancarReceitaPayload) {
    if (salvarRef.current) return;
    salvarRef.current = true;
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
        const res = await fetch(`/api/financeiro/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descricao: descricaoDespesaComParcela(
              descricaoBase,
              payload.parcelas[0]?.parcela || "1/1"
            ),
            valor: payload.totalLiquido,
            data: brShortToIso(payload.parcelas[0]?.vencimento || payload.dataLancamento),
            status: payload.parcelas[0]?.pago ? "pago" : "pendente",
            formaPagamento: payload.parcelas[0]?.formaPagamento || "Boleto",
          }),
        });
        if (!res.ok) throw new Error("Falha ao salvar");
      } else {
        const parcelas = payload.parcelas.map((parcela, index) => ({
          valor:
            Number((parcela.valor || "0").replace(/\./g, "").replace(",", ".")) ||
            payload.totalLiquido / payload.parcelas.length,
          data: brShortToIso(parcela.vencimento || payload.dataLancamento),
          status: parcela.pago ? ("pago" as const) : ("pendente" as const),
          formaPagamento: parcela.formaPagamento || "Boleto",
          parcelaNumero: index + 1,
          parcelaTotal: payload.parcelas.length,
        }));
        const res = await fetch("/api/financeiro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "despesa",
            descricao: descricaoBase,
            valor: parcelas[0]?.valor ?? payload.totalLiquido,
            data: parcelas[0]?.data,
            status: parcelas[0]?.status,
            formaPagamento: parcelas[0]?.formaPagamento || "Boleto",
            parcelas,
          }),
        });
        if (!res.ok) throw new Error("Falha ao salvar");
      }
      setModalAberto(false);
      setEditando(null);
      notificarFinanceiroAtualizado();
      await load({ silencioso: true });
    } finally {
      salvarRef.current = false;
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!despesaExcluir) return;
    const res = await fetch(`/api/financeiro/${despesaExcluir.id}`, {
      method: despesaExcluir.status === "pago" ? "PUT" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body:
        despesaExcluir.status === "pago"
          ? JSON.stringify({ status: "pendente" })
          : undefined,
    });
    if (res.ok) {
      notificarFinanceiroAtualizado();
      await load({ silencioso: true });
    }
    setDespesaExcluir(null);
  }

  function abrirLinha(linha: LinhaBoleto) {
    setDespesaAberta({ lancamento: linha.lancamento, ref: linha.ref });
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] px-4 py-6 sm:px-6 lg:px-8">
      <FinanceiroAbasNav />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-slate-900">
            Controle de Boletos / Contas a Pagar
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Acompanhe boletos e despesas sincronizados com Contas a Pagar ·{" "}
            {dateToBrShort(new Date())}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/financeiro?tipo=despesa"
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Visão clássica
          </Link>
          <Button
            type="button"
            onClick={() => {
              setEditando(null);
              setModalAberto(true);
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Novo Boleto
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardKpi
          titulo="Em análise"
          quantidade={resumo.emAnaliseQtd}
          valor={resumo.emAnaliseValor}
          subtitulo="Vencimento acima de 14 dias"
          corBorda="#f59e0b"
          icone={Clock}
        />
        <CardKpi
          titulo="Aguardando pagamento"
          quantidade={resumo.aguardandoQtd}
          valor={resumo.aguardandoValor}
          subtitulo="Vence nos próximos 14 dias"
          corBorda="#0ea5e9"
          icone={Calendar}
        />
        <CardKpi
          titulo="Pagos no mês"
          quantidade={resumo.pagosMesQtd}
          valor={resumo.pagosMesValor}
          subtitulo="Liquidados no mês atual"
          corBorda="#10b981"
          icone={CheckCircle2}
        />
        <CardKpi
          titulo="Vencidos"
          quantidade={resumo.vencidosQtd}
          valor={resumo.vencidosValor}
          subtitulo="Ação necessária"
          corBorda="#ef4444"
          icone={AlertTriangle}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar fornecedor, categoria..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>
              <CampoDataBr
                label=""
                value={dataInicio}
                onChange={setDataInicio}
                placeholder="Data início"
                className="min-w-[130px]"
              />
              <CampoDataBr
                label=""
                value={dataFim}
                onChange={setDataFim}
                placeholder="Data fim"
                className="min-w-[130px]"
              />
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as FiltroStatusBoleto)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="todos">Todos os status</option>
                <option value="em_analise">Em análise</option>
                <option value="aguardando">Aguardando pagamento</option>
                <option value="vencidos">Vencidos</option>
                <option value="pagos">Pagos</option>
              </select>
            </div>
          </div>

          {erroLista ? (
            <p className="p-6 text-center text-sm text-red-600">{erroLista}</p>
          ) : carregando ? (
            <p className="p-10 text-center text-sm text-slate-400">Carregando boletos...</p>
          ) : linhasOrdenadas.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-400">
              Nenhum boleto encontrado. Lance uma despesa com forma de pagamento Boleto.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px]">
                    <th className="px-4 py-3">
                      <ThOrdenavelBoleto
                        titulo="Fornecedor"
                        coluna="fornecedor"
                        colunaAtiva={colunaOrdenacao}
                        direcao={direcaoOrdenacao}
                        onOrdenar={alternarOrdenacao}
                      />
                    </th>
                    <th className="px-4 py-3">
                      <ThOrdenavelBoleto
                        titulo="Categoria"
                        coluna="categoria"
                        colunaAtiva={colunaOrdenacao}
                        direcao={direcaoOrdenacao}
                        onOrdenar={alternarOrdenacao}
                      />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <ThOrdenavelBoleto
                        titulo="Valor"
                        coluna="valor"
                        colunaAtiva={colunaOrdenacao}
                        direcao={direcaoOrdenacao}
                        onOrdenar={alternarOrdenacao}
                        alinhamento="right"
                      />
                    </th>
                    <th className="px-4 py-3">
                      <ThOrdenavelBoleto
                        titulo="Emissão"
                        coluna="emissao"
                        colunaAtiva={colunaOrdenacao}
                        direcao={direcaoOrdenacao}
                        onOrdenar={alternarOrdenacao}
                      />
                    </th>
                    <th className="px-4 py-3">
                      <ThOrdenavelBoleto
                        titulo="Vencimento"
                        coluna="vencimento"
                        colunaAtiva={colunaOrdenacao}
                        direcao={direcaoOrdenacao}
                        onOrdenar={alternarOrdenacao}
                      />
                    </th>
                    <th className="px-4 py-3">
                      <ThOrdenavelBoleto
                        titulo="Status"
                        coluna="status"
                        colunaAtiva={colunaOrdenacao}
                        direcao={direcaoOrdenacao}
                        onOrdenar={alternarOrdenacao}
                      />
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <CabecalhoGrupo grupo="vencidos" linhas={grupos.vencidos} />
                  {grupos.vencidos.map((linha) => (
                    <LinhaTabela
                      key={linha.lancamento.id}
                      linha={linha}
                      onVer={() => abrirLinha(linha)}
                      onPagar={() =>
                        setDespesaPagar({
                          lancamento: linha.lancamento,
                          ref: linha.ref,
                        })
                      }
                      onEditar={() => {
                        setEditando(linha.lancamento);
                        setModalAberto(true);
                      }}
                    />
                  ))}
                  <CabecalhoGrupo grupo="proximos" linhas={grupos.proximos} />
                  {grupos.proximos.map((linha) => (
                    <LinhaTabela
                      key={linha.lancamento.id}
                      linha={linha}
                      onVer={() => abrirLinha(linha)}
                      onPagar={() =>
                        setDespesaPagar({
                          lancamento: linha.lancamento,
                          ref: linha.ref,
                        })
                      }
                      onEditar={() => {
                        setEditando(linha.lancamento);
                        setModalAberto(true);
                      }}
                    />
                  ))}
                  <CabecalhoGrupo grupo="pagos" linhas={grupos.pagos} />
                  {grupos.pagos.map((linha) => (
                    <LinhaTabela
                      key={linha.lancamento.id}
                      linha={linha}
                      onVer={() => abrirLinha(linha)}
                      onPagar={() =>
                        setDespesaPagar({
                          lancamento: linha.lancamento,
                          ref: linha.ref,
                        })
                      }
                      onEditar={() => {
                        setEditando(linha.lancamento);
                        setModalAberto(true);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              <h2 className="text-[14px] font-semibold text-slate-900">
                Alertas de vencimento
              </h2>
            </div>
            {alertas.length === 0 ? (
              <p className="text-[12px] text-slate-400">Nenhum alerta no momento.</p>
            ) : (
              <ul className="space-y-2">
                {alertas.map((alerta) => (
                  <li
                    key={alerta.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-[12px]",
                      alerta.tipo === "vencido"
                        ? "border-red-100 bg-red-50"
                        : "border-amber-100 bg-amber-50"
                    )}
                  >
                    <p className="font-semibold text-slate-800">{alerta.titulo}</p>
                    <p className="text-slate-600">{alerta.descricao}</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {formatarMoedaBoleto(alerta.valor)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              <h2 className="text-[14px] font-semibold text-slate-900">
                Fluxo de boletos
              </h2>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v) =>
                      Number(v).toLocaleString("pt-BR", { notation: "compact" })
                    }
                  />
                  <Tooltip
                    formatter={(v, name) => [
                      formatarMoedaBoleto(Number(v ?? 0)),
                      name === "pagos" ? "Pagos" : "Pendentes",
                    ]}
                  />
                  <Bar dataKey="pendentes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pagos" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-[12px] text-emerald-900">
            <p className="font-semibold">Sincronização automática</p>
            <p className="mt-1 text-emerald-800/90">
              Boletos e despesas lançados em Contas a Pagar aparecem aqui em tempo real.
              Pagamentos feitos em qualquer tela atualizam ambas.
            </p>
          </div>
        </aside>
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
          void load({ silencioso: true });
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
          void load({ silencioso: true });
        }}
      />

      <DespesaDetalheModal
        open={!!despesaAberta}
        lancamento={despesaAberta?.lancamento ?? null}
        refOs={despesaAberta?.ref}
        onClose={() => setDespesaAberta(null)}
        onEditar={() => {
          if (!despesaAberta?.lancamento) return;
          setEditando(despesaAberta.lancamento);
          setDespesaAberta(null);
          setModalAberto(true);
        }}
        onAnexoClick={setAnexoAberto}
      />

      <ConfirmacaoExclusaoModal
        open={Boolean(despesaExcluir)}
        titulo={
          despesaExcluir?.status === "pago" ? "Desmarcar pagamento" : "Excluir despesa"
        }
        mensagem={
          despesaExcluir?.status === "pago"
            ? "Deseja desmarcar o pagamento deste boleto?"
            : "Deseja excluir este boleto/despesa?"
        }
        onClose={() => setDespesaExcluir(null)}
        onConfirm={confirmarExclusao}
      />

      {modalAberto ? (
        <LancarDespesaModal
          key={editando ? `edit-${editando.id}` : "novo-boleto"}
          open={modalAberto}
          onClose={() => {
            setModalAberto(false);
            setEditando(null);
          }}
          onSubmit={salvarDespesaModal}
          entidades={fornecedores}
          salvando={salvando}
          tituloEdicao={editando ? "Editar Boleto" : "Novo Boleto"}
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
