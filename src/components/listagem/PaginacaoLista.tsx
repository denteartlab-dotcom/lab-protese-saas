"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  pagina: number;
  totalPaginas: number;
  onPagina: (pagina: number) => void;
  className?: string;
};

export function PaginacaoLista({ pagina, totalPaginas, onPagina, className = "" }: Props) {
  if (totalPaginas <= 1) return null;

  const paginasVisiveis = paginasParaExibir(pagina, totalPaginas);

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-1 border-t border-slate-100 px-3 py-3 ${className}`}
    >
      <button
        type="button"
        disabled={pagina <= 1}
        onClick={() => onPagina(pagina - 1)}
        className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {paginasVisiveis.map((n, index) =>
        n === "…" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onPagina(n)}
            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${
              n === pagina
                ? "bg-primary-600 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            aria-current={n === pagina ? "page" : undefined}
          >
            {n}
          </button>
        )
      )}

      <button
        type="button"
        disabled={pagina >= totalPaginas}
        onClick={() => onPagina(pagina + 1)}
        className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function paginasParaExibir(atual: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const paginas = new Set<number>([1, total, atual, atual - 1, atual + 1]);
  const ordenadas = [...paginas].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const resultado: (number | "…")[] = [];
  let anterior = 0;
  for (const n of ordenadas) {
    if (anterior && n - anterior > 1) resultado.push("…");
    resultado.push(n);
    anterior = n;
  }
  return resultado;
}
