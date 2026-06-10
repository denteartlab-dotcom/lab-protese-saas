"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Search, TrendingUp } from "lucide-react";
import type { LinhaTempoProducao } from "@/lib/tempo-producao-relatorio";
import {
  corAvatar,
  corEtapaPremium,
  iniciaisAvatar,
  labelStatusPremium,
} from "@/lib/tempo-producao-premium";
import { cn } from "@/lib/utils";

type Props = {
  linhas: LinhaTempoProducao[];
  busca: string;
  onBuscaChange: (v: string) => void;
  pagina: number;
  porPagina: number;
  onPaginaChange: (p: number) => void;
  onAbrirDetalhe: (id: string) => void;
};

export function ReportPremiumTable({
  linhas,
  busca,
  onBuscaChange,
  pagina,
  porPagina,
  onPaginaChange,
  onAbrirDetalhe,
}: Props) {
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  const linhasPagina = linhas.slice(inicio, inicio + porPagina);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e8ecf2] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Análise de ordens de serviço</h2>
          <p className="text-sm text-slate-500">{linhas.length} OS no período selecionado</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Buscar OS, paciente ou dentista"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-6 py-4">OS</th>
              <th className="px-4 py-4">Paciente</th>
              <th className="px-4 py-4">Serviço</th>
              <th className="px-4 py-4">Etapa Atual</th>
              <th className="px-4 py-4">Tempo na etapa</th>
              <th className="px-4 py-4">Total no laboratório</th>
              <th className="px-4 py-4">Prazo</th>
              <th className="px-4 py-4">Atraso</th>
              <th className="px-4 py-4">Responsável</th>
              <th className="px-4 py-4">Tempo médio colaborador</th>
              <th className="px-4 py-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {linhasPagina.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-6 py-16 text-center text-sm text-slate-400">
                  Nenhuma OS encontrada.
                </td>
              </tr>
            ) : (
              linhasPagina.map((linha) => {
                const etapa = corEtapaPremium(linha.etapaAtual);
                const st = labelStatusPremium(linha.status);
                const atrasada = linha.diasAtraso > 0;
                return (
                  <tr
                    key={linha.id}
                    onClick={() => onAbrirDetalhe(linha.id)}
                    className="group cursor-pointer border-b border-slate-50 transition hover:bg-violet-50/30"
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">#{linha.numeroOs}</span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-slate-800">{linha.paciente}</p>
                      <p className="text-xs text-slate-400">{linha.dentista}</p>
                    </td>
                    <td className="max-w-[140px] px-4 py-4">
                      <p className="truncate text-sm text-slate-700">{linha.tipoServico}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold",
                          etapa.bg,
                          etapa.text
                        )}
                      >
                        {linha.etapaAtual}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "text-sm font-bold",
                            linha.paradoMuitoTempo ? "text-red-600" : "text-slate-800"
                          )}
                        >
                          {linha.diasNaEtapaAtual} dias
                        </span>
                        {linha.paradoMuitoTempo ? (
                          <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-400">desde {linha.dataEntradaEtapaBr}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-800">{linha.diasNoLaboratorio} dias</p>
                      <p className="text-[11px] text-slate-400">entrada {linha.dataEntradaLabBr}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{linha.prazoCombinadoBr}</td>
                    <td className="px-4 py-4">
                      {atrasada ? (
                        <span className="text-sm font-semibold text-red-600">
                          {linha.diasAtraso} dias atrasado
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-emerald-600">— no prazo</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                            corAvatar(linha.colaborador)
                          )}
                        >
                          {iniciaisAvatar(linha.colaborador)}
                        </span>
                        <span className="text-sm font-medium text-slate-700">{linha.colaborador}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-slate-600">
                      {linha.tempoMedioColaborador > 0
                        ? `${linha.tempoMedioColaborador.toLocaleString("pt-BR")} dias`
                        : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                          st.cls
                        )}
                      >
                        {st.label}
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {linhas.length > porPagina ? (
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-sm text-slate-500">
            {inicio + 1}–{Math.min(inicio + porPagina, linhas.length)} de {linhas.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={paginaAtual <= 1}
              onClick={() => onPaginaChange(paginaAtual - 1)}
              className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-slate-600">
              {paginaAtual} / {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => onPaginaChange(paginaAtual + 1)}
              className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
