"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { CalendarClock, Clock3, Stethoscope, User } from "lucide-react";
import { useEtapaTempo } from "@/components/modulo-tv/hooks/useEtapaTempo";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import { TvBadge } from "@/components/modulo-tv/ui/TvBadge";
import { TV_GLASS_CARD } from "@/components/modulo-tv/tv-styles";
import type { OrdemServicoTv } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

const BORDA_PRIORIDADE: Record<OrdemServicoTv["prioridade"], string> = {
  urgente:
    "border-l-red-500 shadow-[0_4px_28px_rgba(239,68,68,0.18),inset_0_1px_0_rgba(255,255,255,0.05)]",
  alta: "border-l-orange-500 shadow-[0_4px_24px_rgba(249,115,22,0.14)]",
  normal: "border-l-sky-400/90 shadow-[0_4px_20px_rgba(56,189,248,0.08)]",
  baixa: "border-l-slate-500/60",
};

type Props = {
  ordem: OrdemServicoTv;
  index: number;
  isOverlay?: boolean;
};

export function TvOsCard({ ordem, index, isOverlay = false }: Props) {
  const tempoEtapa = useEtapaTempo(ordem.etapaDesde);
  const isNova = useTvDashboardStore((s) => s.novasOsIds.includes(ordem.id));

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: ordem.id,
      data: { coluna: ordem.coluna, ordem },
      disabled: isOverlay,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <motion.article
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      layout={!isDragging}
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{
        opacity: isDragging && !isOverlay ? 0.35 : 1,
        y: 0,
        scale: isNova ? [1, 1.03, 1] : 1,
      }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{
        duration: 0.4,
        delay: index * 0.025,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={isOverlay ? undefined : { y: -2, transition: { duration: 0.25 } }}
      {...(isOverlay ? {} : { ...listeners, ...attributes })}
      className={cn(
        "group relative cursor-grab overflow-hidden border-l-[3px] p-3 active:cursor-grabbing tv:p-3.5 tv-4k:p-4",
        TV_GLASS_CARD,
        BORDA_PRIORIDADE[ordem.prioridade],
        ordem.atrasada && "tv-atrasada-pulse ring-1 ring-red-500/45",
        isNova && "tv-nova-glow ring-2 ring-cyan-400/50",
        !isOverlay &&
          "transition-shadow duration-300 hover:border-white/[0.12] hover:shadow-[0_8px_40px_rgba(59,130,246,0.12),0_0_24px_rgba(139,92,246,0.08)]"
      )}
    >
      {isNova ? (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-400/15 via-transparent to-violet-400/15"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: 3 }}
        />
      ) : null}

      <div className="relative mb-2.5 flex items-start justify-between gap-2">
        <span className="rounded-lg border border-white/[0.08] bg-white/[0.06] px-2.5 py-1 font-tv-mono text-sm font-bold tabular-nums text-white backdrop-blur-sm tv:text-base tv-4k:text-lg">
          OS {ordem.numeroOs}
        </span>
        <div className="flex flex-col items-end gap-1">
          <TvBadge prioridade={ordem.prioridade} />
          {isNova ? (
            <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-cyan-200 tv:text-[9px]">
              Nova
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative space-y-2 text-[11px] text-slate-300 tv:text-xs tv-4k:text-sm">
        <p className="flex items-center gap-2 font-medium text-slate-100">
          <User className="h-3.5 w-3.5 shrink-0 text-cyan-400/90 tv:h-4 tv:w-4" />
          <span className="truncate">{ordem.paciente}</span>
        </p>
        <p className="flex items-center gap-2">
          <Stethoscope className="h-3.5 w-3.5 shrink-0 text-violet-400/90 tv:h-4 tv:w-4" />
          <span className="truncate text-slate-300">{ordem.dentista}</span>
        </p>
        <p className="flex items-center gap-2 text-slate-400">
          <span className="truncate text-cyan-300/80">{ordem.colaborador}</span>
        </p>
        <p
          className={cn(
            "flex items-center gap-2",
            ordem.atrasada ? "font-semibold text-red-400" : "text-slate-400"
          )}
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0 tv:h-4 tv:w-4" />
          <span className="truncate">
            Prazo {ordem.prazo}
            {ordem.atrasada ? " · ATRASADA" : ""}
          </span>
        </p>
        <p className="flex items-center gap-2 text-slate-500">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-violet-400/70 tv:h-4 tv:w-4" />
          <span className="font-tv-mono text-[10px] tv:text-[11px]">
            {tempoEtapa} nesta etapa
          </span>
        </p>
      </div>

      <p className="relative mt-2.5 truncate rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-1.5 text-[10px] font-medium text-slate-400 tv:text-[11px] tv-4k:text-xs">
        {ordem.status}
      </p>
    </motion.article>
  );
}
