import { cn } from "@/lib/utils";
import type { PrioridadeOs } from "@/components/modulo-tv/types";

const ESTILOS: Record<
  PrioridadeOs,
  { label: string; className: string }
> = {
  urgente: {
    label: "URGENTE",
    className:
      "bg-red-500/20 text-red-300 ring-1 ring-red-400/50 shadow-[0_0_12px_rgba(239,68,68,0.35)]",
  },
  alta: {
    label: "ALTA",
    className:
      "bg-orange-500/20 text-orange-300 ring-1 ring-orange-400/40 shadow-[0_0_10px_rgba(249,115,22,0.25)]",
  },
  normal: {
    label: "NORMAL",
    className: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30",
  },
  baixa: {
    label: "BAIXA",
    className: "bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/30",
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
        "inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider 2xl:text-[11px]",
        estilo.className,
        className
      )}
    >
      {estilo.label}
    </span>
  );
}
