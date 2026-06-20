"use client";

import {
  normalizarPeriodoCobranca,
  type PeriodoCobranca,
} from "@/lib/master-planos";
import { cn } from "@/lib/utils";

type Props = {
  periodo: PeriodoCobranca;
  onChange: (periodo: PeriodoCobranca) => void;
  className?: string;
};

export function SeletorPeriodoCobranca({ periodo, onChange, className }: Props) {
  const ativo = normalizarPeriodoCobranca(periodo);

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-slate-200 bg-slate-100 p-1",
        className
      )}
      role="tablist"
      aria-label="Período de cobrança"
    >
      {(["mensal", "anual"] as const).map((opcao) => {
        const selecionado = ativo === opcao;
        return (
          <button
            key={opcao}
            type="button"
            role="tab"
            aria-selected={selecionado}
            onClick={() => onChange(opcao)}
            className={cn(
              "relative rounded-full px-4 py-2 text-sm font-semibold transition",
              selecionado
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {opcao === "mensal" ? "Mensal" : "Anual"}
            {opcao === "anual" ? (
              <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Economize
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
