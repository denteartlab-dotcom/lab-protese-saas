"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Home, Moon, Printer, RefreshCw, Sun } from "lucide-react";
import { BottleneckRanking } from "@/components/relatorios/tempo-producao/BottleneckRanking";
import { CollaboratorPerformanceChart } from "@/components/relatorios/tempo-producao/CollaboratorPerformanceChart";
import { CriticalAlertBanner } from "@/components/relatorios/tempo-producao/CriticalAlertBanner";
import { DelayByStageChart } from "@/components/relatorios/tempo-producao/DelayByStageChart";
import { OsDetalheModal } from "@/components/relatorios/tempo-producao/OsDetalheModal";
import { ProductionTimeTable } from "@/components/relatorios/tempo-producao/ProductionTimeTable";
import { ReportFilters } from "@/components/relatorios/tempo-producao/ReportFilters";
import { ReportSkeleton } from "@/components/relatorios/tempo-producao/ReportSkeleton";
import { ReportSummaryCards } from "@/components/relatorios/tempo-producao/ReportSummaryCards";
import { StatusDistributionChart } from "@/components/relatorios/tempo-producao/StatusDistributionChart";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { readStorage, writeStorage } from "@/lib/persisted-storage";
import { persistirTemaLocal, lerTemaLocal } from "@/lib/theme-ui";
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

const filtrosIniciais: FiltrosTempoProducao = {};
const POR_PAGINA_PADRAO = 15;

export function ProductionTimeReportPage() {
  const [filtros, setFiltros] = useState<FiltrosTempoProducao>(filtrosIniciais);
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
  const [porPagina, setPorPagina] = useState(POR_PAGINA_PADRAO);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = readStorage<string | null>("labProteseTheme", null);
    const localTheme = lerTemaLocal();
    const dark = savedTheme === "dark" || (savedTheme === null && localTheme === true);
    setDarkMode(dark);
    persistirTemaLocal(dark);
  }, []);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    persistirTemaLocal(next);
    writeStorage("labProteseTheme", next ? "dark" : "light");
    setDarkMode(next);
  }

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
      const res = await fetch(`/api/relatorios/tempo-producao?${queryString}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao carregar");
      setLinhas(data.linhas ?? []);
      setResumo(data.resumo ?? null);
      setGraficos(data.graficos ?? null);
      setOpcoes(data.opcoes ?? { dentistas: [], colaboradores: [], etapas: [], tiposServico: [] });
      setFonte(data.fonte === "mock" ? "mock" : "banco");
      setAviso(data.aviso ?? (data.fonte === "mock" ? "Exibindo dados de demonstração." : ""));
      setPagina(1);
    } catch {
      setAviso("Não foi possível carregar o relatório.");
    } finally {
      setCarregando(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 300);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  function abrirDetalhePorOs(numeroOs: number) {
    const linha = linhas.find((l) => l.numeroOs === numeroOs);
    if (linha) setDetalheId(linha.id);
  }

  async function exportarPdf() {
    setExportandoPdf(true);
    try {
      await abrirPdfGerando(() =>
        gerarTempoProducaoPdf(
          linhas,
          filtros.dataInicio || filtros.dataFim
            ? `Período: ${filtros.dataInicio || "…"} a ${filtros.dataFim || "…"}`
            : "Todas as OS em produção"
        )
      );
    } finally {
      setExportandoPdf(false);
    }
  }

  function imprimirA4() {
    window.print();
  }

  const periodoTexto =
    filtros.dataInicio || filtros.dataFim
      ? `${filtros.dataInicio || "…"} a ${filtros.dataFim || "…"}`
      : "Todas as OS em produção";

  return (
    <div
      className={cn(
        "min-h-0 flex-1 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900",
        "print:bg-white print:text-black"
      )}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print {
            @page { size: A4 landscape; margin: 12mm; }
            body * { visibility: hidden; }
            #relatorio-tempo-producao-print, #relatorio-tempo-producao-print * { visibility: visible; }
            #relatorio-tempo-producao-print { position: absolute; left: 0; top: 0; width: 100%; }
          }`,
        }}
      />

      <div className="border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 sm:px-6 print:hidden">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 tv:max-w-[2200px]">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-violet-600 text-white shadow-md">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tv:text-2xl">
                Tempo de Produção
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 tv:text-base">
                Identifique gargalos, atrasos e responsáveis em cada etapa do laboratório.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              title={darkMode ? "Modo claro" : "Modo escuro"}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={imprimirA4}
              className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 sm:inline-flex"
            >
              <Printer className="h-4 w-4" />
              A4
            </button>
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Home className="h-4 w-4" />
              Início
            </Link>
            <button
              type="button"
              onClick={() => void carregar()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <RefreshCw className={cn("h-4 w-4", carregando && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div
        id="relatorio-tempo-producao-print"
        className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 tv:max-w-[2200px] tv:space-y-6 tv:px-8"
      >
        <div className="hidden print:block print:mb-4">
          <h1 className="text-lg font-bold">Relatório — Tempo de Produção</h1>
          <p className="text-sm text-slate-600">{periodoTexto}</p>
          {resumo ? (
            <p className="mt-1 text-xs text-slate-500">
              {resumo.totalEmProducao} OS em produção · {resumo.totalAtrasadas} atrasadas ·{" "}
              {resumo.totalCriticas} críticas
            </p>
          ) : null}
        </div>

        {aviso ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 print:hidden">
            {aviso}
            {fonte === "mock" ? " Os valores são fictícios para demonstração." : ""}
          </div>
        ) : null}

        <div className="print:hidden">
          <ReportFilters filtros={filtros} opcoes={opcoes} onChange={setFiltros} />
        </div>

        {carregando && !resumo ? (
          <ReportSkeleton />
        ) : (
          <>
            {resumo ? (
              <>
                <CriticalAlertBanner resumo={resumo} onVerOs={abrirDetalhePorOs} />
                <ReportSummaryCards resumo={resumo} />
              </>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-3 print:hidden">
              <div className="xl:col-span-2">
                {graficos ? <DelayByStageChart dados={graficos.atrasoPorEtapa} /> : null}
              </div>
              <div>
                {graficos ? <StatusDistributionChart distribuicao={graficos.distribuicaoStatus} /> : null}
              </div>
            </div>

            {graficos ? (
              <div className="print:hidden">
                <BottleneckRanking
                  rankingEtapas={graficos.rankingEtapasParado}
                  rankingColaboradores={graficos.rankingColaboradoresAtraso}
                />
              </div>
            ) : null}

            {graficos ? (
              <div className="print:hidden">
                <CollaboratorPerformanceChart tempoMedio={graficos.tempoMedioPorColaborador} />
              </div>
            ) : null}

            <ProductionTimeTable
              linhas={linhas}
              pagina={pagina}
              porPagina={porPagina}
              onPaginaChange={setPagina}
              onPorPaginaChange={(n) => {
                setPorPagina(n);
                setPagina(1);
              }}
              onExportarCsv={() => exportarTempoProducaoCsv(linhas)}
              onExportarExcel={() => void exportarTempoProducaoExcel(linhas)}
              onExportarPdf={() => void exportarPdf()}
              onImprimir={imprimirA4}
              onAbrirDetalhe={setDetalheId}
              exportandoPdf={exportandoPdf}
            />
          </>
        )}
      </div>

      <OsDetalheModal trabalhoId={detalheId} onClose={() => setDetalheId(null)} />
    </div>
  );
}
