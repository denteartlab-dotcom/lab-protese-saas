import { cn } from "@/lib/utils";
import type { PrioridadeOs } from "@/components/modulo-tv/types";

const ESTILOS: Record<PrioridadeOs, { label: string; className: string }> = {
  urgente: {
    label: "URGENTE",
    className: "bg-red-500/20 text-red-300 border border-red-500/30",
  },
  alta: {
    label: "ALTA",
    className: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  },
  normal: {
    label: "MÉDIA",
    className: "bg-sky-500/15 text-sky-300 border border-sky-500/25",
  },
  baixa: {
    label: "BAIXA",
    className: "bg-slate-500/20 text-slate-400 border border-slate-500/30",
  },
};

type Props = {
  prioridade: PrioridadeOs;
  className?: string;
};

export function TvBadge({ prioridade, className }: Props) {
  const estilo = ESTILOS[prioridade];
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider tv:text-[9px] tv-4k:text-[10px]",
        estilo.className,
        className
      )}
    >
      {estilo.label}
    </span>
  );
}
