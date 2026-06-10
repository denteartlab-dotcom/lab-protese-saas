"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  Calendar,
  ChevronDown,
  Download,
  Filter,
  Info,
  RefreshCw,
  Search,
  Sun,
} from "lucide-react";
import { OsDetalheModal } from "@/components/relatorios/tempo-producao/OsDetalheModal";
import { ReportFilters } from "@/components/relatorios/tempo-producao/ReportFilters";
import { ReportPremiumAnalytics } from "@/components/relatorios/tempo-producao/ReportPremiumAnalytics";
import { ReportPremiumKpiCards } from "@/components/relatorios/tempo-producao/ReportPremiumKpiCards";
import { ReportPremiumSidebar } from "@/components/relatorios/tempo-producao/ReportPremiumSidebar";
import { ReportPremiumTable } from "@/components/relatorios/tempo-producao/ReportPremiumTable";
import { ReportSkeleton } from "@/components/relatorios/tempo-producao/ReportSkeleton";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { gerarTempoProducaoPdf } from "@/lib/relatorios-impressao-pdf";
import {
  exportarTempoProducaoCsv,
  exportarTempoProducaoExcel,
  type FiltrosTempoProducao,
  type GraficosTempoProducao,
  type LinhaTempoProducao,
  type ResumoTempoProducao,
} from "@/lib/tempo-producao-relatorio";
import { cn } from "@/lib/utils";

type OpcoesFiltro = {
  dentistas: string[];
  colaboradores: string[];
  etapas: string[];
  tiposServico: string[];
};

const POR_PAGINA = 8;

export function ProductionTimeReportPage() {
  const [filtros, setFiltros] = useState<FiltrosTempoProducao>({});
  const [linhas, setLinhas] = useState<LinhaTempoProducao[]>([]);
  const [resumo, setResumo] = useState<ResumoTempoProducao | null>(null);
  const [graficos, setGraficos] = useState<GraficosTempoProducao | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesFiltro>({
    dentistas: [],
    colaboradores: [],
    etapas: [],
    tiposServico: [],
  });
  const [fonte, setFonte] = useState<"banco" | "mock">("banco");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [exportAberto, setExportAberto] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filtros.dataInicio) p.set("dataInicio", filtros.dataInicio);
    if (filtros.dataFim) p.set("dataFim", filtros.dataFim);
    if (filtros.dentista) p.set("dentista", filtros.dentista);
    if (filtros.colaborador) p.set("colaborador", filtros.colaborador);
    if (filtros.etapa) p.set("etapa", filtros.etapa);
    if (filtros.status) p.set("status", filtros.status);
    if (filtros.tipoServico) p.set("tipoServico", filtros.tipoServico);
    if (filtros.apenasAtrasados) p.set("apenasAtrasados", "1");
    if (filtros.apenasCriticos) p.set("apenasCriticos", "1");
    if (filtros.busca) p.set("busca", filtros.busca);
    return p.toString();
  }, [filtros]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/relatorios/tempo-producao?${queryString}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao carregar");
      setLinhas(data.linhas ?? []);
      setResumo(data.resumo ?? null);
      setGraficos(data.graficos ?? null);
      setOpcoes(data.opcoes ?? { dentistas: [], colaboradores: [], etapas: [], tiposServico: [] });
      setFonte(data.fonte === "mock" ? "mock" : "banco");
      setAviso(data.aviso ?? (data.fonte === "mock" ? "Exibindo dados de demonstração." : ""));
      setUltimaAtualizacao(new Date());
      setPagina(1);
    } catch {
      setAviso("Não foi possível carregar o relatório.");
    } finally {
      setCarregando(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 250);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  useEffect(() => {
    const timer = window.setInterval(() => void carregar(), 60_000);
    return () => window.clearInterval(timer);
  }, [carregar]);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportAberto(false);
      }
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const periodoLabel = useMemo(() => {
    if (filtros.dataInicio && filtros.dataFim) return `${filtros.dataInicio} - ${filtros.dataFim}`;
    if (filtros.dataInicio) return `${filtros.dataInicio} - hoje`;
    const hoje = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
    const inicioMes = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "dd/MM/yyyy", {
      locale: ptBR,
    });
    return `${inicioMes} - ${hoje}`;
  }, [filtros.dataInicio, filtros.dataFim]);

  async function exportarPdf() {
    setExportandoPdf(true);
    setExportAberto(false);
    try {
      await abrirPdfGerando(() => gerarTempoProducaoPdf(linhas, `Período: ${periodoLabel}`));
    } finally {
      setExportandoPdf(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#eef1f6]">
      <ReportPremiumSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top utility bar */}
        <div className="flex items-center justify-end gap-3 border-b border-[#e8ecf2] bg-white/80 px-5 py-3 backdrop-blur-sm lg:px-8">
          <button
            type="button"
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Buscar"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Notificações"
          >
            <Bell className="h-5 w-5" />
            {resumo && resumo.totalAtrasadas > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {Math.min(resumo.totalAtrasadas, 9)}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Tema"
          >
            <Sun className="h-5 w-5" />
          </button>
          <div className="ml-1 flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">Administrador</p>
              <p className="text-xs text-slate-400">Laboratório</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">
              AD
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-8 lg:py-8 tv:px-10 tv:py-10">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
                <span>Relatórios</span>
                <span className="text-slate-300">›</span>
                <span>Produção</span>
                <span className="text-slate-300">›</span>
                <span className="font-medium text-violet-600">Tempo por Etapa</span>
              </nav>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 tv:text-4xl">
                Relatório de Tempo por Etapa
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-sm">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="font-medium">{periodoLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => setFiltrosAbertos(true)}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Filter className="h-4 w-4" />
                Filtros
              </button>
              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  onClick={() => setExportAberto((v) => !v)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Exportar
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
                {exportAberto ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        exportarTempoProducaoCsv(linhas);
                        setExportAberto(false);
                      }}
                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportarTempoProducaoExcel(linhas);
                        setExportAberto(false);
                      }}
                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Excel
                    </button>
                    <button
                      type="button"
                      disabled={exportandoPdf}
                      onClick={() => void exportarPdf()}
                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {exportandoPdf ? "Gerando PDF…" : "PDF"}
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void carregar()}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700"
              >
                <RefreshCw className={cn("h-4 w-4", carregando && "animate-spin")} />
                Atualizar
              </button>
            </div>
          </div>

          {aviso ? (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {aviso}
              {fonte === "mock" ? " Dados fictícios para demonstração." : ""}
            </div>
          ) : null}

          {carregando && !resumo ? (
            <ReportSkeleton />
          ) : (
            <div className="space-y-6 tv:space-y-8">
              {resumo ? <ReportPremiumKpiCards resumo={resumo} /> : null}
              <ReportPremiumTable
                linhas={linhas}
                busca={filtros.busca ?? ""}
                onBuscaChange={(busca) => setFiltros((f) => ({ ...f, busca: busca || undefined }))}
                pagina={pagina}
                porPagina={POR_PAGINA}
                onPaginaChange={setPagina}
                onAbrirDetalhe={setDetalheId}
              />
              {graficos ? <ReportPremiumAnalytics graficos={graficos} /> : null}
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-violet-100 bg-violet-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-violet-900/80">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
              Dica: OS em vermelho estão atrasadas. Clique em uma linha para ver a linha do tempo completa,
              responsáveis e anexos.
            </p>
            <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Última atualização:{" "}
              {ultimaAtualizacao
                ? format(ultimaAtualizacao, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                : "—"}
              <span className="text-slate-300">·</span>
              Atualização automática a cada 60s
            </div>
          </div>
        </div>
      </div>

      {filtrosAbertos ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px]">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">Filtros avançados</h2>
              <button
                type="button"
                onClick={() => setFiltrosAbertos(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <ReportFilters filtros={filtros} opcoes={opcoes} onChange={setFiltros} />
            </div>
            <div className="border-t border-slate-100 p-5">
              <button
                type="button"
                onClick={() => setFiltrosAbertos(false)}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <OsDetalheModal trabalhoId={detalheId} onClose={() => setDetalheId(null)} />
    </div>
  );
}
