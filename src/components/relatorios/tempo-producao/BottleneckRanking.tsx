"use client";

import { Layers, Timer, Users } from "lucide-react";
import type { GraficosTempoProducao } from "@/lib/tempo-producao-relatorio";
import { InfoTooltip } from "@/components/relatorios/tempo-producao/InfoTooltip";
import { TOOLTIPS_TEMPO_PRODUCAO } from "@/lib/tempo-producao-relatorio";
import { cn } from "@/lib/utils";

type Props = {
  rankingEtapas: GraficosTempoProducao["rankingEtapasParado"];
  rankingColaboradores: GraficosTempoProducao["rankingColaboradoresAtraso"];
};

export function BottleneckRanking({ rankingEtapas, rankingColaboradores }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Ranking de gargalos — etapas
          </h3>
          <InfoTooltip texto={TOOLTIPS_TEMPO_PRODUCAO.gargalo} />
        </div>
        <ol className="space-y-2">
          {(rankingEtapas.length ? rankingEtapas : [{ etapa: "Sem dados", diasMedio: 0, os: 0 }]).map(
            (item, i) => (
              <li
                key={`${item.etapa}-${i}`}
                className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-700/40"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    i === 0
                      ? "bg-violet-600 text-white"
                      : "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {item.etapa}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.os} OS nesta etapa</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-violet-700 dark:text-violet-300">
                    {item.diasMedio}d
                  </p>
                  <p className="text-[10px] text-slate-400">média parado</p>
                </div>
              </li>
            )
          )}
        </ol>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Ranking — colaboradores com atraso
          </h3>
          <InfoTooltip texto="Quantidade de OS atrasadas sob responsabilidade de cada colaborador na etapa atual." />
        </div>
        <ol className="space-y-2">
          {(rankingColaboradores.length
            ? rankingColaboradores
            : [{ colaborador: "Nenhum", osAtrasadas: 0 }]
          ).map((item, i) => (
            <li
              key={`${item.colaborador}-${i}`}
              className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-700/40"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  i === 0
                    ? "bg-orange-600 text-white"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                )}
              >
                {i + 1}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {item.colaborador}
              </p>
              <span className="inline-flex items-center gap-1 font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                <Timer className="h-3.5 w-3.5" />
                {item.osAtrasadas} OS
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
