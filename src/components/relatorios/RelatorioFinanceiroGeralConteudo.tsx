"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { PainelCarregando } from "@/components/ListaCarregando";
import { Modal } from "@/components/ui";
import { dateToBrShort } from "@/lib/datas-br";
import { TRABALHOS_ATUALIZADOS_EVENT } from "@/lib/trabalhos-events";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import {
  exportarModalAReceberConcluidosPdf,
  exportarRelatorioFinanceiroGeralExcel,
  exportarRelatorioFinanceiroGeralPdf,
} from "@/lib/relatorio-financeiro-geral-export";
import {
  CATEGORIAS_TIPO_SERVICO,
  formatarMoedaFinanceiroGeral,
  formatarPercentualFinanceiroGeral,
  type FiltrosRelatorioFinanceiroGeral,
  type LinhaDetalheFinanceiroGeral,
  type RelatorioFinanceiroGeralPayload,
} from "@/lib/relatorio-financeiro-geral";
import { STATUS_TRABALHO } from "@/lib/utils";
import { cn } from "@/lib/utils";

const COR = {
  azul: "#3498db",
  verde: "#2ecc71",
  roxo: "#8e44ad",
  laranja: "#f39c12",
  grid: "#e8e8e8",
  texto: "#6b7280",
} as const;

const CORES_DONUT = [
  "#3498db",
  "#2ecc71",
  "#8e44ad",
  "#f39c12",
  "#1abc9c",
  "#e74c3c",
  "#95a5a6",
];

const labelClass = "mb-1 block text-[11px] font-medium text-[#6b7280] dark:text-slate-400";
const selectClass =
  "h-[36px] w-full rounded-lg border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-[12px] text-[#374151] dark:text-slate-200 outline-none focus:border-[#3498db] focus:ring-1 focus:ring-[#3498db]/20";
const inputClass =
  "h-[36px] w-full rounded-lg border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 text-[12px] text-[#374151] dark:text-slate-200 shadow-none outline-none focus:border-[#3498db] focus:ring-1 focus:ring-[#3498db]/20";

function primeiroDiaAnoBr() {
  const hoje = new Date();
  return dateToBrShort(new Date(hoje.getFullYear(), 0, 1));
}

function hojeBr() {
  return dateToBrShort(new Date());
}

function TooltipMoeda({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] shadow-lg">
      <p className="mb-1 font-semibold text-[#374151] dark:text-slate-200">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || COR.texto }}>
          {p.name}: {formatarMoedaFinanceiroGeral(Number(p.value) || 0)}
        </p>
      ))}
    </div>
  );
}

function CardKpi({
  titulo,
  valor,
  subtitulo,
  cor = COR.laranja,
}: {
  titulo: string;
  valor: string;
  subtitulo?: string;
  cor?: string;
}) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af] dark:text-slate-500">
        {titulo}
      </p>
      <p className="mt-2 text-[22px] font-bold tabular-nums" style={{ color: cor }}>
        {valor}
      </p>
      {subtitulo ? (
        <p className="mt-1 text-[11px] text-[#9ca3af] dark:text-slate-500">{subtitulo}</p>
      ) : null}
    </div>
  );
}

function CardGrafico({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm",
        className
      )}
    >
      <h3 className="mb-3 text-[13px] font-semibold text-[#374151] dark:text-slate-200">{titulo}</h3>
      {children}
    </div>
  );
}

type ColunaDetalhe = keyof LinhaDetalheFinanceiroGeral | "valor";

type FiltroConcluidosMes =
  | { tipo: "mes"; mes: string; ano: number; mesIdx: number }
  | { tipo: "total" }
  | null;

const ITENS_POR_PAGINA = 10;

export function RelatorioFinanceiroGeralConteudo() {
  const [filtros, setFiltros] = useState<FiltrosRelatorioFinanceiroGeral>({
    dataInicio: primeiroDiaAnoBr(),
    dataFim: hojeBr(),
    cliente: "Todos",
    tipoServico: "Todos",
    status: "Todos",
  });
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtros);
  const [dados, setDados] = useState<RelatorioFinanceiroGeralPayload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatusTabela, setFiltroStatusTabela] = useState("Todos");
  const [ordenarPor, setOrdenarPor] = useState<ColunaDetalhe>("numeroOs");
  const [ordenarDir, setOrdenarDir] = useState<"asc" | "desc">("desc");
  const [pagina, setPagina] = useState(1);
  const [paginaModal, setPaginaModal] = useState(1);
  const [detalheConcluidosMes, setDetalheConcluidosMes] = useState<FiltroConcluidosMes>(null);

  const carregar = useCallback(async (f: FiltrosRelatorioFinanceiroGeral) => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        dataInicio: f.dataInicio,
        dataFim: f.dataFim,
        cliente: f.cliente,
        tipoServico: f.tipoServico,
        status: f.status,
      });
      const res = await fetch(`/api/relatorios/relatorio-financeiro-geral?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Falha ao carregar");
      const json = (await res.json()) as RelatorioFinanceiroGeralPayload;
      setDados(json);
    } catch {
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar(filtrosAplicados);
  }, [carregar, filtrosAplicados]);

  useEffect(() => {
    const atualizar = () => void carregar(filtrosAplicados);
    window.addEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizar);
    return () => window.removeEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizar);
  }, [carregar, filtrosAplicados]);

  const aplicarFiltros = () => {
    setFiltrosAplicados({ ...filtros });
    setPagina(1);
  };

  const linhasConcluidosModal = useMemo(() => {
    if (!dados || !detalheConcluidosMes) return [];
    let lista = dados.detalhes.filter((l) => l.concluido);
    if (detalheConcluidosMes.tipo === "mes") {
      lista = lista.filter(
        (l) =>
          l.anoConclusao === detalheConcluidosMes.ano &&
          l.mesConclusao === detalheConcluidosMes.mesIdx
      );
    }
    return lista.sort((a, b) => b.numeroOs - a.numeroOs);
  }, [dados, detalheConcluidosMes]);

  const totalConcluidosModal = useMemo(
    () => linhasConcluidosModal.reduce((s, l) => s + l.valor, 0),
    [linhasConcluidosModal]
  );

  const tituloConcluidosModal = useMemo(() => {
    if (!detalheConcluidosMes) return "";
    if (detalheConcluidosMes.tipo === "total") {
      return "A receber — concluídos no período";
    }
    return `A receber — concluídos em ${detalheConcluidosMes.mes}/${detalheConcluidosMes.ano}`;
  }, [detalheConcluidosMes]);

  useEffect(() => {
    setPaginaModal(1);
  }, [detalheConcluidosMes]);

  const totalPaginasModal = Math.max(
    1,
    Math.ceil(linhasConcluidosModal.length / ITENS_POR_PAGINA)
  );
  const linhasConcluidosModalPagina = linhasConcluidosModal.slice(
    (paginaModal - 1) * ITENS_POR_PAGINA,
    paginaModal * ITENS_POR_PAGINA
  );

  const imprimirModalConcluidos = () => {
    if (!linhasConcluidosModal.length) return;
    void abrirPdfGerando(() =>
      exportarModalAReceberConcluidosPdf(
        tituloConcluidosModal,
        linhasConcluidosModal,
        totalConcluidosModal
      )
    );
  };

  const detalhesFiltrados = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    let lista = [...dados.detalhes];
    if (filtroStatusTabela === "Concluídos") {
      lista = lista.filter((l) => l.concluido);
    } else if (filtroStatusTabela === "Não Concluídos") {
      lista = lista.filter((l) => !l.concluido);
    }
    if (termo) {
      lista = lista.filter(
        (l) =>
          String(l.numeroOs).includes(termo) ||
          l.cliente.toLowerCase().includes(termo) ||
          l.servico.toLowerCase().includes(termo) ||
          l.responsavel.toLowerCase().includes(termo)
      );
    }
    lista.sort((a, b) => {
      const dir = ordenarDir === "asc" ? 1 : -1;
      const va = a[ordenarPor as keyof LinhaDetalheFinanceiroGeral];
      const vb = b[ordenarPor as keyof LinhaDetalheFinanceiroGeral];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR") * dir;
    });
    return lista;
  }, [dados, busca, filtroStatusTabela, ordenarPor, ordenarDir]);

  const totalPaginas = Math.max(1, Math.ceil(detalhesFiltrados.length / ITENS_POR_PAGINA));
  const detalhesPagina = detalhesFiltrados.slice(
    (pagina - 1) * ITENS_POR_PAGINA,
    pagina * ITENS_POR_PAGINA
  );

  function alternarOrdenacao(col: ColunaDetalhe) {
    if (ordenarPor === col) {
      setOrdenarDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrdenarPor(col);
      setOrdenarDir("desc");
    }
  }

  function IconeOrdenacao({ col }: { col: ColunaDetalhe }) {
    if (ordenarPor !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    return ordenarDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  }

  const exportarPdf = () => {
    if (!dados) return;
    void abrirPdfGerando(() => exportarRelatorioFinanceiroGeralPdf(dados, filtrosAplicados));
  };

  const exportarExcel = () => {
    if (!dados) return;
    void exportarRelatorioFinanceiroGeralExcel(dados, filtrosAplicados);
  };

  const evolucaoChart = dados?.evolucaoMensal ?? [];
  const donutData = dados?.distribuicaoTipo ?? [];
  const financeiroRealizadoChart = dados?.financeiroRealizado.porMes ?? [];

  return (
    <div className="relative -mx-3 min-h-screen w-[calc(100%+1.5rem)] bg-white dark:bg-slate-900 text-[#374151] dark:text-slate-200 sm:-mx-5 sm:w-[calc(100%+2.5rem)]">
      <div className="w-full max-w-none px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold text-[#1f2937] dark:text-slate-100">
              Relatório Financeiro Geral
            </h1>
            <p className="mt-1 text-[13px] text-[#6b7280] dark:text-slate-400">
              Produção em aberto (valor do serviço) e a receber de serviços Finalizados ou Entregues
              no período (saldo em Contas a Receber, incluindo produto e transporte da OS). Saiu para
              Entrega conta como em aberto.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-[#e5e7eb] dark:border-slate-700 bg-[#fafafa] dark:bg-slate-800/70 p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className={labelClass}>Data Inicial</label>
              <CampoDataBr
                value={filtros.dataInicio}
                onChange={(v) => setFiltros((f) => ({ ...f, dataInicio: v }))}
                placeholder="dd/mm/aaaa"
                iconPosition="left"
                className="space-y-0"
                inputClassName={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Data Final</label>
              <CampoDataBr
                value={filtros.dataFim}
                onChange={(v) => setFiltros((f) => ({ ...f, dataFim: v }))}
                placeholder="dd/mm/aaaa"
                iconPosition="left"
                className="space-y-0"
                inputClassName={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Cliente</label>
              <select
                className={selectClass}
                value={filtros.cliente}
                onChange={(e) => setFiltros((f) => ({ ...f, cliente: e.target.value }))}
              >
                <option value="Todos">Todos</option>
                {(dados?.clientesOpcoes ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tipo de Serviço</label>
              <select
                className={selectClass}
                value={filtros.tipoServico}
                onChange={(e) => setFiltros((f) => ({ ...f, tipoServico: e.target.value }))}
              >
                <option value="Todos">Todos</option>
                {CATEGORIAS_TIPO_SERVICO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={selectClass}
                value={filtros.status}
                onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="Todos">Todos</option>
                {Object.entries(STATUS_TRABALHO).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-1">
              <button
                type="button"
                onClick={aplicarFiltros}
                className="inline-flex h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#3498db] px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-[#2980b9]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportarPdf}
              disabled={!dados || carregando}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-[12px] font-medium text-[#374151] dark:text-slate-200 shadow-sm hover:bg-[#f9fafb] dark:bg-slate-800/70 disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={exportarExcel}
              disabled={!dados || carregando}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-[12px] font-medium text-[#374151] dark:text-slate-200 shadow-sm hover:bg-[#f9fafb] dark:bg-slate-800/70 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Exportar Excel
            </button>
          </div>
        </div>

        {carregando ? (
          <div className="min-h-[480px] rounded-xl border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <PainelCarregando mensagem="Carregando relatório financeiro geral..." />
          </div>
        ) : !dados ? (
          <div className="rounded-xl border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center text-[#6b7280] dark:text-slate-400">
            Não foi possível carregar os dados.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <CardKpi
                titulo="Valor Bruto Total"
                valor={formatarMoedaFinanceiroGeral(dados.resumo.valorBrutoTotal)}
                cor={COR.laranja}
              />
              <CardKpi
                titulo="Quantidade Total"
                valor={String(dados.resumo.quantidadeTotal)}
                subtitulo="OS no período"
                cor={COR.azul}
              />
              <CardKpi
                titulo="Ticket Médio"
                valor={formatarMoedaFinanceiroGeral(dados.resumo.ticketMedio)}
                cor={COR.laranja}
              />
              <CardKpi
                titulo="Valor Médio Mensal"
                valor={formatarMoedaFinanceiroGeral(dados.resumo.valorMedioMensal)}
                cor={COR.laranja}
              />
              <CardKpi
                titulo="Serviços Não Concluídos"
                valor={String(dados.resumo.naoConcluidosQtd)}
                subtitulo={formatarMoedaFinanceiroGeral(dados.resumo.naoConcluidosValor)}
                cor={COR.azul}
              />
              <CardKpi
                titulo="Serviços Concluídos"
                valor={String(dados.resumo.concluidosQtd)}
                subtitulo={`${formatarMoedaFinanceiroGeral(dados.resumo.concluidosValor)} a receber`}
                cor={COR.verde}
              />
            </div>

            <div className="rounded-xl border border-[#e5e7eb] dark:border-slate-700 bg-[#f9fafb] dark:bg-slate-800/70 p-4">
              <h2 className="mb-3 text-[14px] font-semibold text-[#374151] dark:text-slate-200">
                Financeiro realizado — lançamentos pagos
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <CardKpi
                  titulo="Receitas Realizadas"
                  valor={formatarMoedaFinanceiroGeral(
                    dados.financeiroRealizado.resumo.receitasTotal
                  )}
                  subtitulo={`${dados.financeiroRealizado.resumo.receitasQtd} lançamentos`}
                  cor={COR.verde}
                />
                <CardKpi
                  titulo="Despesas Realizadas"
                  valor={formatarMoedaFinanceiroGeral(
                    dados.financeiroRealizado.resumo.despesasTotal
                  )}
                  subtitulo={`${dados.financeiroRealizado.resumo.despesasQtd} lançamentos`}
                  cor={COR.azul}
                />
                <CardKpi
                  titulo="Saldo do Período"
                  valor={formatarMoedaFinanceiroGeral(
                    dados.financeiroRealizado.resumo.saldoTotal
                  )}
                  cor={COR.roxo}
                />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <CardGrafico titulo="Receitas x Despesas Realizadas por Mês">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financeiroRealizadoChart}>
                      <CartesianGrid stroke={COR.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: COR.texto }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: COR.texto }}
                        tickFormatter={(v) =>
                          Number(v).toLocaleString("pt-BR", { notation: "compact" })
                        }
                      />
                      <Tooltip content={<TooltipMoeda />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="receitas"
                        name="Receitas"
                        fill={COR.verde}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="despesas"
                        name="Despesas"
                        fill={COR.azul}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardGrafico>

              <CardGrafico titulo="Saldo Realizado por Mês">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-[#e5e7eb] dark:border-slate-700 bg-[#f9fafb] dark:bg-slate-800/70 text-[11px] uppercase tracking-wide text-[#6b7280] dark:text-slate-400">
                        <th className="px-3 py-2">Mês</th>
                        <th className="px-3 py-2 text-right">Receitas</th>
                        <th className="px-3 py-2 text-right">Despesas</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeiroRealizadoChart.map((m) => (
                        <tr key={`${m.mes}-${m.ano}-fin`} className="border-b border-[#f3f4f6]">
                          <td className="px-3 py-2 font-medium">
                            {m.mes}/{m.ano}
                          </td>
                          <td className="px-3 py-2 text-right text-[#2ecc71]">
                            {formatarMoedaFinanceiroGeral(m.receitas)}
                          </td>
                          <td className="px-3 py-2 text-right text-[#3498db]">
                            {formatarMoedaFinanceiroGeral(m.despesas)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-[#8e44ad]">
                            {formatarMoedaFinanceiroGeral(m.saldo)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#f9fafb] dark:bg-slate-800/70 font-bold">
                        <td className="px-3 py-2">TOTAL</td>
                        <td className="px-3 py-2 text-right text-[#2ecc71]">
                          {formatarMoedaFinanceiroGeral(
                            dados.financeiroRealizado.resumo.receitasTotal
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-[#3498db]">
                          {formatarMoedaFinanceiroGeral(
                            dados.financeiroRealizado.resumo.despesasTotal
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-[#8e44ad]">
                          {formatarMoedaFinanceiroGeral(
                            dados.financeiroRealizado.resumo.saldoTotal
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardGrafico>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <CardGrafico titulo="Evolução Mensal — Produção e A Receber">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={evolucaoChart}>
                      <CartesianGrid stroke={COR.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: COR.texto }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: COR.texto }}
                        tickFormatter={(v) =>
                          Number(v).toLocaleString("pt-BR", { notation: "compact" })
                        }
                      />
                      <Tooltip content={<TooltipMoeda />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="naoConcluido"
                        name="Não Concluído"
                        fill={COR.azul}
                        radius={[4, 4, 0, 0]}
                        barSize={18}
                      />
                      <Bar
                        dataKey="concluido"
                        name="A receber (concluídos)"
                        fill={COR.verde}
                        radius={[4, 4, 0, 0]}
                        barSize={18}
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Total"
                        stroke={COR.roxo}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: COR.roxo }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardGrafico>

              <CardGrafico titulo="Distribuição por Tipo de Serviço">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData.length ? donutData : [{ tipo: "Sem dados", valor: 1 }]}
                        dataKey="valor"
                        nameKey="tipo"
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        label={(props) => {
                          const p = props as unknown as {
                            tipo?: string;
                            percentual?: number;
                          };
                          return `${p.tipo ?? ""} ${formatarPercentualFinanceiroGeral(p.percentual ?? 0)}`;
                        }}
                        labelLine={false}
                      >
                        {(donutData.length ? donutData : [{ tipo: "Sem dados", valor: 1 }]).map(
                          (entry, i) => (
                            <Cell
                              key={entry.tipo}
                              fill={CORES_DONUT[i % CORES_DONUT.length]}
                            />
                          )
                        )}
                      </Pie>
                      <Tooltip
                        formatter={(valor, _nome, props) => {
                          const p = (props as { payload?: { quantidade?: number; percentual?: number } })
                            ?.payload;
                          const num = Number(valor) || 0;
                          return [
                            `${formatarMoedaFinanceiroGeral(num)} · ${p?.quantidade ?? 0} OS · ${formatarPercentualFinanceiroGeral(p?.percentual ?? 0)}`,
                            String(_nome ?? ""),
                          ];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardGrafico>

              <CardGrafico titulo="Status dos Serviços">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-center text-[12px] font-semibold text-[#3498db]">
                      Não Concluídos
                    </p>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: "Não Concluídos",
                                value: dados.statusResumo.naoConcluidos.valor || 1,
                              },
                            ]}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            fill={COR.azul}
                          />
                          <Tooltip
                            formatter={() =>
                              formatarMoedaFinanceiroGeral(
                                dados.statusResumo.naoConcluidos.valor
                              )
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-center text-[12px]">
                      <p className="font-bold text-[#374151] dark:text-slate-200">
                        {dados.statusResumo.naoConcluidos.quantidade} OS
                      </p>
                      <p className="text-[#3498db]">
                        {formatarMoedaFinanceiroGeral(dados.statusResumo.naoConcluidos.valor)}
                      </p>
                      <p className="text-[#9ca3af] dark:text-slate-500">
                        {formatarPercentualFinanceiroGeral(
                          dados.statusResumo.naoConcluidos.percentual
                        )}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-center text-[12px] font-semibold text-[#2ecc71]">
                      Concluídos (a receber)
                    </p>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: "Concluídos",
                                value: dados.statusResumo.concluidos.valor || 1,
                              },
                            ]}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            fill={COR.verde}
                          />
                          <Tooltip
                            formatter={() =>
                              formatarMoedaFinanceiroGeral(dados.statusResumo.concluidos.valor)
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-center text-[12px]">
                      <p className="font-bold text-[#374151] dark:text-slate-200">
                        {dados.statusResumo.concluidos.quantidade} OS
                      </p>
                      <p className="text-[#2ecc71]">
                        {formatarMoedaFinanceiroGeral(dados.statusResumo.concluidos.valor)}
                      </p>
                      <p className="text-[#9ca3af] dark:text-slate-500">
                        {formatarPercentualFinanceiroGeral(
                          dados.statusResumo.concluidos.percentual
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardGrafico>

              <CardGrafico titulo="Valor Bruto por Mês">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evolucaoChart}>
                      <CartesianGrid stroke={COR.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: COR.texto }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: COR.texto }}
                        tickFormatter={(v) =>
                          Number(v).toLocaleString("pt-BR", { notation: "compact" })
                        }
                      />
                      <Tooltip content={<TooltipMoeda />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="naoConcluido"
                        name="Não Concluído"
                        fill={COR.azul}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="concluido"
                        name="A receber (concluídos)"
                        fill={COR.verde}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardGrafico>
            </div>

            <CardGrafico titulo="Valores por Mês">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] dark:border-slate-700 bg-[#f9fafb] dark:bg-slate-800/70 text-[11px] uppercase tracking-wide text-[#6b7280] dark:text-slate-400">
                      <th className="px-3 py-2">Mês</th>
                      <th className="px-3 py-2 text-right">Valor Não Concluído</th>
                      <th className="px-3 py-2 text-right">A Receber (Concluídos)</th>
                      <th className="px-3 py-2 text-right">Valor Total</th>
                      <th className="px-3 py-2 text-center">Quantidade</th>
                      <th className="px-3 py-2 text-right">Ticket Médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.tabelaPorMes.map((m) => (
                      <tr key={`${m.mes}-${m.ano}`} className="border-b border-[#f3f4f6]">
                        <td className="px-3 py-2 font-medium">
                          {m.mes}/{m.ano}
                        </td>
                        <td className="px-3 py-2 text-right text-[#3498db]">
                          {formatarMoedaFinanceiroGeral(m.naoConcluido)}
                        </td>
                        <td className="px-3 py-2 text-right text-[#2ecc71]">
                          {m.concluido > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setDetalheConcluidosMes({
                                  tipo: "mes",
                                  mes: m.mes,
                                  ano: m.ano,
                                  mesIdx: m.mesIdx,
                                })
                              }
                              className="font-medium text-[#2ecc71] underline decoration-[#2ecc71]/40 underline-offset-2 transition hover:text-[#27ae60] hover:decoration-[#27ae60]"
                              title="Ver OS concluídas deste mês"
                            >
                              {formatarMoedaFinanceiroGeral(m.concluido)}
                            </button>
                          ) : (
                            formatarMoedaFinanceiroGeral(m.concluido)
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-[#8e44ad]">
                          {formatarMoedaFinanceiroGeral(m.total)}
                        </td>
                        <td className="px-3 py-2 text-center">{m.quantidade}</td>
                        <td className="px-3 py-2 text-right">
                          {formatarMoedaFinanceiroGeral(m.ticketMedio)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#f9fafb] dark:bg-slate-800/70 font-bold">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-right text-[#3498db]">
                        {formatarMoedaFinanceiroGeral(dados.resumo.naoConcluidosValor)}
                      </td>
                      <td className="px-3 py-2 text-right text-[#2ecc71]">
                        {dados.resumo.concluidosValor > 0 ? (
                          <button
                            type="button"
                            onClick={() => setDetalheConcluidosMes({ tipo: "total" })}
                            className="font-bold text-[#2ecc71] underline decoration-[#2ecc71]/40 underline-offset-2 transition hover:text-[#27ae60] hover:decoration-[#27ae60]"
                            title="Ver todas as OS concluídas no período"
                          >
                            {formatarMoedaFinanceiroGeral(dados.resumo.concluidosValor)}
                          </button>
                        ) : (
                          formatarMoedaFinanceiroGeral(dados.resumo.concluidosValor)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-[#8e44ad]">
                        {formatarMoedaFinanceiroGeral(dados.resumo.valorBrutoTotal)}
                      </td>
                      <td className="px-3 py-2 text-center">{dados.resumo.quantidadeTotal}</td>
                      <td className="px-3 py-2 text-right">
                        {formatarMoedaFinanceiroGeral(dados.resumo.ticketMedio)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardGrafico>

            <CardGrafico titulo="Valor por Tipo de Serviço">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] dark:border-slate-700 bg-[#f9fafb] dark:bg-slate-800/70 text-[11px] uppercase tracking-wide text-[#6b7280] dark:text-slate-400">
                      <th className="px-3 py-2">Serviço</th>
                      <th className="px-3 py-2 text-center">Quantidade</th>
                      <th className="px-3 py-2 text-right">Valor Total</th>
                      <th className="px-3 py-2 text-right">Percentual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.tabelaPorTipo.map((t) => (
                      <tr key={t.servico} className="border-b border-[#f3f4f6]">
                        <td className="px-3 py-2 font-medium">{t.servico}</td>
                        <td className="px-3 py-2 text-center">{t.quantidade}</td>
                        <td className="px-3 py-2 text-right">
                          {formatarMoedaFinanceiroGeral(t.valor)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatarPercentualFinanceiroGeral(t.percentual)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardGrafico>

            <CardGrafico titulo="Serviços Detalhados">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af] dark:text-slate-500" />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setPagina(1);
                    }}
                    placeholder="Buscar OS, cliente, serviço..."
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <select
                  className={`${selectClass} w-auto min-w-[160px]`}
                  value={filtroStatusTabela}
                  onChange={(e) => {
                    setFiltroStatusTabela(e.target.value);
                    setPagina(1);
                  }}
                >
                  <option value="Todos">Todos os status</option>
                  <option value="Concluídos">Concluídos</option>
                  <option value="Não Concluídos">Não Concluídos</option>
                </select>
                <span className="text-[11px] text-[#9ca3af] dark:text-slate-500">
                  {detalhesFiltrados.length} registro(s)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] dark:border-slate-700 bg-[#f9fafb] dark:bg-slate-800/70 text-[11px] uppercase tracking-wide text-[#6b7280] dark:text-slate-400">
                      {(
                        [
                          ["numeroOs", "Nº OS"],
                          ["cliente", "Cliente"],
                          ["servico", "Serviço"],
                          ["valor", "Valor"],
                          ["dataEntrada", "Data Entrada"],
                          ["prazo", "Prazo"],
                          ["diasProducao", "Dias Prod."],
                          ["statusLabel", "Status"],
                          ["etapaAtual", "Etapa Atual"],
                          ["responsavel", "Responsável"],
                        ] as [ColunaDetalhe, string][]
                      ).map(([col, label]) => (
                        <th key={col} className="px-3 py-2">
                          <button
                            type="button"
                            className="inline-flex items-center font-semibold hover:text-[#3498db]"
                            onClick={() => alternarOrdenacao(col)}
                          >
                            {label}
                            <IconeOrdenacao col={col} />
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detalhesPagina.map((d) => (
                      <tr key={d.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa] dark:bg-slate-800/70">
                        <td className="px-3 py-2 font-mono font-semibold">{d.numeroOs}</td>
                        <td className="px-3 py-2">{d.cliente}</td>
                        <td className="px-3 py-2">{d.servico}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatarMoedaFinanceiroGeral(d.valor)}
                        </td>
                        <td className="px-3 py-2">{d.dataEntrada}</td>
                        <td className="px-3 py-2">{d.prazo}</td>
                        <td className="px-3 py-2 text-center">{d.diasProducao}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              d.concluido
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-blue-100 text-blue-700"
                            )}
                          >
                            {d.statusLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2">{d.etapaAtual}</td>
                        <td className="px-3 py-2">{d.responsavel}</td>
                      </tr>
                    ))}
                    {detalhesPagina.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-[#9ca3af] dark:text-slate-500">
                          Nenhum serviço encontrado.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {totalPaginas > 1 ? (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={pagina <= 1}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-[#e5e7eb] dark:border-slate-700 px-3 py-1 text-[12px] disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-[12px] text-[#6b7280] dark:text-slate-400">
                    Página {pagina} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    disabled={pagina >= totalPaginas}
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    className="rounded-lg border border-[#e5e7eb] dark:border-slate-700 px-3 py-1 text-[12px] disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              ) : null}
            </CardGrafico>
          </div>
        )}
      </div>

      <Modal
        open={detalheConcluidosMes !== null}
        onClose={() => setDetalheConcluidosMes(null)}
        title={tituloConcluidosModal}
        size="lg"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-xl text-[12px] text-[#6b7280] dark:text-slate-400">
            Valores a receber de serviços Finalizados ou Entregues (serviço + produto + transporte da
            mesma OS, saldo em Contas a Receber ou valor da OS quando ainda não faturada).
          </p>
          {linhasConcluidosModal.length > 0 ? (
            <button
              type="button"
              onClick={imprimirModalConcluidos}
              className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-[12px] font-medium text-[#374151] dark:text-slate-200 shadow-sm hover:bg-[#f9fafb] dark:bg-slate-800/70"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
          ) : null}
        </div>
        {linhasConcluidosModal.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#9ca3af] dark:text-slate-500">
            Nenhuma OS concluída neste período.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[#e5e7eb] dark:border-slate-700 bg-[#f9fafb] dark:bg-slate-800/70 text-[11px] uppercase tracking-wide text-[#6b7280] dark:text-slate-400">
                    <th className="px-3 py-2">OS</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Serviço</th>
                    <th className="px-3 py-2">Conclusão</th>
                    <th className="px-3 py-2">Situação</th>
                    <th className="px-3 py-2 text-right">A receber</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasConcluidosModalPagina.map((linha) => (
                    <tr key={linha.id} className="border-b border-[#f3f4f6]">
                      <td className="px-3 py-2 font-mono font-semibold">{linha.numeroOs}</td>
                      <td className="px-3 py-2">{linha.cliente}</td>
                      <td className="px-3 py-2">{linha.servico}</td>
                      <td className="px-3 py-2">{linha.dataConclusao}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {linha.statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-[#2ecc71]">
                        {formatarMoedaFinanceiroGeral(linha.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#f9fafb] dark:bg-slate-800/70 font-bold">
                    <td className="px-3 py-2" colSpan={5}>
                      TOTAL ({linhasConcluidosModal.length} OS)
                    </td>
                    <td className="px-3 py-2 text-right text-[#2ecc71]">
                      {formatarMoedaFinanceiroGeral(totalConcluidosModal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {totalPaginasModal > 1 ? (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={paginaModal <= 1}
                  onClick={() => setPaginaModal((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-[#e5e7eb] dark:border-slate-700 px-3 py-1 text-[12px] disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-[12px] text-[#6b7280] dark:text-slate-400">
                  Página {paginaModal} de {totalPaginasModal}
                </span>
                <button
                  type="button"
                  disabled={paginaModal >= totalPaginasModal}
                  onClick={() => setPaginaModal((p) => Math.min(totalPaginasModal, p + 1))}
                  className="rounded-lg border border-[#e5e7eb] dark:border-slate-700 px-3 py-1 text-[12px] disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            ) : null}
          </>
        )}
      </Modal>
    </div>
  );
}
