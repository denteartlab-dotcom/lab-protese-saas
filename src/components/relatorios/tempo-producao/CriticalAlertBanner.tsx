"use client";

import { AlertOctagon, ChevronRight } from "lucide-react";
import type { ResumoTempoProducao } from "@/lib/tempo-producao-relatorio";
import { cn } from "@/lib/utils";

type Props = {
  resumo: ResumoTempoProducao;
  onVerOs?: (numeroOs: number) => void;
};

export function CriticalAlertBanner({ resumo, onVerOs }: Props) {
  if (resumo.totalCriticas <= 0) return null;

  const lista = resumo.osCriticasLista ?? [];

  return (
    <div className="overflow-hidden rounded-xl border-2 border-red-300 bg-gradient-to-r from-red-50 via-red-50/80 to-orange-50 shadow-md dark:border-red-800 dark:from-red-950/80 dark:via-red-950/50 dark:to-orange-950/40">
      <div className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow">
          <AlertOctagon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-red-800 dark:text-red-300">
            {resumo.totalCriticas} OS em situação crítica
          </h2>
          <p className="mt-0.5 text-xs text-red-700/90 dark:text-red-400/90">
            Mais de 3 dias de atraso — ação imediata recomendada para evitar perda de clientes.
          </p>
          {lista.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {lista.map((item) => (
                <li key={item.numeroOs}>
                  <button
                    type="button"
                    onClick={() => onVerOs?.(item.numeroOs)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-red-800 shadow-sm transition hover:bg-red-100",
                      "dark:border-red-800 dark:bg-red-950/60 dark:text-red-200 dark:hover:bg-red-900/60"
                    )}
                  >
                    <span className="font-bold">OS {item.numeroOs}</span>
                    <span className="text-red-600 dark:text-red-400">+{item.diasAtraso}d</span>
                    <span className="max-w-[100px] truncate text-red-600/80 dark:text-red-400/80">
                      {item.etapa}
                    </span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
