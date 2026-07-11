"use client";

import { ChevronLeft, ChevronRight, Eye, FileSpreadsheet, FileText, PauseCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { InfoTooltip } from "@/components/relatorios/tempo-producao/InfoTooltip";
import {
  labelPrioridadeTempo,
  labelStatusTempo,
  tooltipTempo,
} from "@/components/relatorios/tempo-producao/tempo-i18n";
import {
  LIMIAR_DIAS_PARADO_DESTAQUE,
  PRIORIDADE_TEMPO_PRODUCAO,
  STATUS_TEMPO_PRODUCAO,
  type LinhaTempoProducao,
} from "@/lib/tempo-producao-relatorio";
import { cn } from "@/lib/utils";

type Props = {
  linhas: LinhaTempoProducao[];
  pagina: number;
  porPagina: number;
  onPaginaChange: (pagina: number) => void;
  onPorPaginaChange: (n: number) => void;
  onExportarCsv: () => void;
  onExportarExcel: () => void;
  onExportarPdf: () => void;
  onImprimir: () => void;
  onAbrirDetalhe: (id: string) => void;
  exportandoPdf?: boolean;
};

const OPCOES_PAGINA = [10, 15, 25, 50, 100];

export function ProductionTimeTable({
  linhas,
  pagina,
  porPagina,
  onPaginaChange,
  onPorPaginaChange,
  onExportarCsv,
  onExportarExcel,
  onExportarPdf,
  onImprimir,
  onAbrirDetalhe,
  exportandoPdf,
}: Props) {
  const { t } = useI18n();
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  const linhasPagina = linhas.slice(inicio, inicio + porPagina);

  return (
    <div
      id="tabela-tempo-producao"
      className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/90 print:border print:shadow-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700 print:hidden">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("relatorio.tempo.detalhamentoOs")}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("relatorio.tempo.registrosOrdenados", { total: linhas.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportarCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={onExportarExcel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Excel
          </button>
          <button
            type="button"
            onClick={onExportarPdf}
            disabled={exportandoPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <FileText className="h-3.5 w-3.5" />
            {exportandoPdf ? t("relatorio.gerando") : "PDF"}
          </button>
          <button
            type="button"
            onClick={onImprimir}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <FileText className="h-3.5 w-3.5" />
            {t("relatorio.tempo.imprimirA4")}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1320px] text-left text-xs print:min-w-0 print:text-[9px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              <th className="px-3 py-2.5">{t("relatorio.comum.os")}</th>
              <th className="px-3 py-2.5">{t("relatorio.comum.paciente")}</th>
              <th className="px-3 py-2.5">{t("relatorio.tempo.dentista")}</th>
              <th className="px-3 py-2.5">{t("relatorio.comum.servico")}</th>
              <th className="px-3 py-2.5">{t("relatorio.tempo.etapaAtual")}</th>
              <th className="px-3 py-2.5">{t("relatorio.comum.colaborador")}</th>
              <th className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1">
                  {t("relatorio.tempo.respAtraso")}
                  <InfoTooltip texto={tooltipTempo("responsavelAtraso", t)} />
                </span>
              </th>
              <th className="px-3 py-2.5">{t("relatorio.tempo.entradaLab")}</th>
              <th className="px-3 py-2.5">{t("relatorio.tempo.naEtapaDesde")}</th>
              <th className="px-3 py-2.5">{t("relatorio.tempo.prazo")}</th>
              <th className="px-3 py-2.5 text-center">
                <span className="inline-flex items-center gap-1">
                  {t("relatorio.tempo.diasLab")}
                  <InfoTooltip texto={tooltipTempo("diasLaboratorio", t)} />
                </span>
              </th>
              <th className="px-3 py-2.5 text-center">
                <span className="inline-flex items-center gap-1">
                  {t("relatorio.tempo.parado")}
                  <InfoTooltip texto={tooltipTempo("diasEtapa", t)} />
                </span>
              </th>
              <th className="px-3 py-2.5 text-center">
                <span className="inline-flex items-center gap-1">
                  {t("relatorio.tempo.atraso")}
                  <InfoTooltip texto={tooltipTempo("diasAtraso", t)} />
                </span>
              </th>
              <th className="px-3 py-2.5">{t("relatorio.filtro.status")}</th>
              <th className="px-3 py-2.5">{t("relatorio.tempo.prioridade")}</th>
              <th className="px-3 py-2.5">{t("relatorio.tempo.ultMov")}</th>
              <th className="px-3 py-2.5 text-center print:hidden">{t("relatorio.comum.acoes")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {linhasPagina.length === 0 ? (
              <tr>
                <td colSpan={17} className="px-4 py-10 text-center text-sm text-slate-500">
                  {t("relatorio.tempo.semOsFiltros")}
                </td>
              </tr>
            ) : (
              linhasPagina.map((linha) => {
                const st = STATUS_TEMPO_PRODUCAO[linha.status];
                const pr = PRIORIDADE_TEMPO_PRODUCAO[linha.prioridade];
                const paradoDestaque = linha.paradoMuitoTempo;
                const ehCritico = linha.status === "critico";
                return (
                  <tr
                    key={linha.id}
                    className={cn(
                      "transition border-l-4",
                      ehCritico
                        ? cn(st.bg, st.border)
                        : "border-l-slate-200 bg-white dark:border-l-slate-600 dark:bg-slate-900/25",
                      paradoDestaque &&
                        (ehCritico
                          ? "ring-1 ring-inset ring-amber-400/60 dark:ring-amber-600/50"
                          : "ring-1 ring-inset ring-amber-300 dark:ring-amber-700/60"),
                      ehCritico
                        ? "hover:bg-red-100/70 dark:hover:bg-red-950/55"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-100">
                      {linha.numeroOs}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2.5 text-slate-700 dark:text-slate-300">
                      {linha.paciente}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {linha.dentista}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2.5 text-slate-700 dark:text-slate-300">
                      {linha.tipoServico}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2.5 font-medium text-violet-700 dark:text-violet-300">
                      {linha.etapaAtual}
                    </td>
                    <td className="max-w-[100px] truncate px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {linha.colaborador}
                    </td>
                    <td className="max-w-[100px] truncate px-3 py-2.5 font-medium text-red-700 dark:text-red-400">
                      {linha.responsavelPeloAtraso}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {linha.dataEntradaLabBr}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {linha.dataEntradaEtapaBr}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {linha.prazoCombinadoBr}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-slate-700 dark:text-slate-300">
                      {linha.diasNoLaboratorio}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 font-mono font-semibold",
                          paradoDestaque
                            ? "rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                            : "text-amber-700 dark:text-amber-400"
                        )}
                        title={
                          paradoDestaque
                            ? t("relatorio.tempo.paradoHa", {
                                dias: linha.diasNaEtapaAtual,
                                limiar: LIMIAR_DIAS_PARADO_DESTAQUE,
                              })
                            : undefined
                        }
                      >
                        {paradoDestaque ? <PauseCircle className="h-3 w-3" /> : null}
                        {linha.diasNaEtapaAtual}d
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-red-600 dark:text-red-400">
                      {linha.diasAtraso > 0 ? `${linha.diasAtraso}d` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          ehCritico
                            ? cn(st.bg, st.cor, "ring-1 ring-red-200 dark:ring-red-800")
                            : cn(st.bg, st.cor)
                        )}
                      >
                        {labelStatusTempo(linha.status, t)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          pr.className
                        )}
                      >
                        {labelPrioridadeTempo(linha.prioridade, t)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 dark:text-slate-400">
                      {linha.ultimaMovimentacaoBr}
                    </td>
                    <td className="px-3 py-2.5 text-center print:hidden">
                      <button
                        type="button"
                        onClick={() => onAbrirDetalhe(linha.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-[10px] font-medium text-primary-700 hover:bg-primary-100 dark:bg-primary-900/40 dark:text-primary-300 dark:hover:bg-primary-900/60"
                        title={t("relatorio.comum.verLinhaTempo")}
                      >
                        <Eye className="h-3 w-3" />
                        {t("relatorio.comum.detalhesBtn")}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {linhas.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-700 print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {t("relatorio.comum.registrosIntervalo", {
                de: inicio + 1,
                ate: Math.min(inicio + porPagina, linhas.length),
                total: linhas.length,
              })}
            </span>
            <select
              value={porPagina}
              onChange={(e) => onPorPaginaChange(Number(e.target.value))}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
            >
              {OPCOES_PAGINA.map((n) => (
                <option key={n} value={n}>
                  {t("relatorio.comum.porPagina", { n })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={paginaAtual <= 1}
              onClick={() => onPaginaChange(paginaAtual - 1)}
              className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 dark:border-slate-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs text-slate-600 dark:text-slate-300">
              {t("relatorio.comum.paginaDe", { pagina: paginaAtual, total: totalPaginas })}
            </span>
            <button
              type="button"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => onPaginaChange(paginaAtual + 1)}
              className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 dark:border-slate-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
