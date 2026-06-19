"use client";

import { Filter, Monitor, Volume2, VolumeX } from "lucide-react";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import { TV_GLASS_SUBTLE, TV_TEXT_LABEL } from "@/components/modulo-tv/tv-styles";
import type { ColaboradorTv, PrioridadeOs } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

const PRIORIDADES: { value: PrioridadeOs | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "urgente", label: "Urgente" },
  { value: "alta", label: "Alta" },
  { value: "normal", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

type Props = {
  colaboradores: ColaboradorTv[];
};

export function TvFilters({ colaboradores }: Props) {
  const {
    filtroColaborador,
    filtroPrioridade,
    sonsAtivos,
    modoKiosk,
    setFiltroColaborador,
    setFiltroPrioridade,
    setSonsAtivos,
    setModoKiosk,
  } = useTvDashboardStore();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 px-3 py-2 tv:gap-3 tv:px-4 tv:py-2.5 tv-4k:gap-4",
        TV_GLASS_SUBTLE
      )}
    >
      <span className={cn("flex items-center gap-1.5", TV_TEXT_LABEL)}>
        <Filter className="h-3 w-3" />
        Filtros
      </span>

      <select
        value={filtroColaborador ?? ""}
        onChange={(e) =>
          setFiltroColaborador(e.target.value ? e.target.value : null)
        }
        className="rounded-lg border border-white/[0.1] bg-black/30 px-2.5 py-1.5 text-[11px] text-slate-200 outline-none backdrop-blur-sm transition focus:border-cyan-400/40 tv:text-xs tv-4k:text-sm"
      >
        <option value="">Todos colaboradores</option>
        {colaboradores.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
            {!c.online ? " (offline)" : ""}
          </option>
        ))}
      </select>

      <select
        value={filtroPrioridade}
        onChange={(e) =>
          setFiltroPrioridade(e.target.value as PrioridadeOs | "todas")
        }
        className="rounded-lg border border-white/[0.1] bg-black/30 px-2.5 py-1.5 text-[11px] text-slate-200 outline-none backdrop-blur-sm transition focus:border-violet-400/40 tv:text-xs tv-4k:text-sm"
      >
        {PRIORIDADES.map((p) => (
          <option key={p.value} value={p.value}>
            Prioridade: {p.label}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSonsAtivos(!sonsAtivos)}
          title={sonsAtivos ? "Desativar sons" : "Ativar sons"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition tv:text-xs",
            sonsAtivos
              ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
              : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white"
          )}
        >
          {sonsAtivos ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <VolumeX className="h-3.5 w-3.5" />
          )}
          Sons
        </button>

        <button
          type="button"
          onClick={() => setModoKiosk(!modoKiosk)}
          title="Modo TV kiosk"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition tv:text-xs",
            modoKiosk
              ? "border-violet-400/35 bg-violet-500/12 text-violet-200 shadow-[0_0_16px_rgba(139,92,246,0.2)]"
              : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white"
          )}
        >
          <Monitor className="h-3.5 w-3.5" />
          Kiosk
        </button>
      </div>
    </div>
  );
}
