import { cn } from "@/lib/utils";
import type { PrioridadeOs } from "@/components/modulo-tv/types";

const ESTILOS: Record<
  PrioridadeOs,
  { label: string; className: string }
> = {
  urgente: {
    label: "URGENTE",
    className:
      "border border-red-400/30 bg-red-500/15 text-red-200 shadow-[0_0_16px_rgba(239,68,68,0.35)] backdrop-blur-sm",
  },
  alta: {
    label: "ALTA",
    className:
      "border border-orange-400/30 bg-orange-500/15 text-orange-200 shadow-[0_0_14px_rgba(249,115,22,0.28)] backdrop-blur-sm",
  },
  normal: {
    label: "NORMAL",
    className:
      "border border-sky-400/25 bg-sky-500/12 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.15)] backdrop-blur-sm",
  },
  baixa: {
    label: "BAIXA",
    className:
      "border border-slate-500/25 bg-slate-500/15 text-slate-300 backdrop-blur-sm",
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
        "inline-flex rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] tv:text-[10px] tv-4k:text-[11px]",
        estilo.className,
        className
      )}
    >
      {estilo.label}
    </span>
  );
}
