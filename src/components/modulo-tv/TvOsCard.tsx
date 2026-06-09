"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { useEtapaTempo } from "@/components/modulo-tv/hooks/useEtapaTempo";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import { TvBadge } from "@/components/modulo-tv/ui/TvBadge";
import { TV_OS_CARD } from "@/components/modulo-tv/tv-styles";
import type { OrdemServicoTv } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

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
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <motion.article
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      layout={!isDragging}
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: isDragging && !isOverlay ? 0.4 : 1,
        y: 0,
        scale: isNova ? [1, 1.02, 1] : 1,
      }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, delay: index * 0.02 }}
      whileHover={isOverlay ? undefined : { y: -1 }}
      {...(isOverlay ? {} : { ...listeners, ...attributes })}
      className={cn(
        "cursor-grab p-3 active:cursor-grabbing tv:p-3.5 tv-4k:p-4",
        TV_OS_CARD,
        ordem.atrasada &&
          "border-red-500/40 bg-red-950/20 tv-atrasada-pulse ring-1 ring-red-500/30",
        isNova && "tv-nova-glow ring-1 ring-cyan-400/40",
        !isOverlay &&
          "hover:border-slate-600/50 hover:shadow-[0_4px_20px_rgba(59,130,246,0.1)]"
      )}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <span className="font-tv-mono text-sm font-bold text-white tv:text-base">
          OS {ordem.numeroOs}
        </span>
        <TvBadge prioridade={ordem.prioridade} />
      </div>

      <div className="space-y-1.5 text-[11px] tv:text-xs tv-4k:text-sm">
        <p className="truncate font-semibold text-slate-100">{ordem.paciente}</p>
        <p className="truncate text-slate-400">{ordem.dentista}</p>
        <p
          className={cn(
            "font-medium",
            ordem.atrasada ? "text-red-400" : "text-slate-400"
          )}
        >
          Prazo {ordem.prazo}
          {ordem.atrasada ? " · ATRASADA" : ""}
        </p>
        <p className="font-tv-mono text-[10px] text-violet-300/80 tv:text-[11px]">
          {tempoEtapa} na etapa
        </p>
        <p className="text-slate-500">
          Resp. <span className="text-slate-300">{ordem.colaborador}</span>
        </p>
      </div>

      <p className="mt-2.5 truncate rounded-md bg-slate-800/60 px-2 py-1 text-[10px] text-slate-400 tv:text-[11px]">
        {ordem.status}
      </p>
    </motion.article>
  );
}
