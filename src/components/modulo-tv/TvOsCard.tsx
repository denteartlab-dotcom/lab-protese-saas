"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { useEtapaTempo } from "@/components/modulo-tv/hooks/useEtapaTempo";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import {
  classificarPrazoTv,
  estilosCardPrazoTv,
  labelPrazoCard,
} from "@/components/modulo-tv/lib/prazo-categoria";
import { TvBadge } from "@/components/modulo-tv/ui/TvBadge";
import { TV_OS_CARD } from "@/components/modulo-tv/tv-styles";
import type { OrdemServicoTv } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

type Props = {
  ordem: OrdemServicoTv;
  index: number;
  isOverlay?: boolean;
  onAbrirResumo?: (ordem: OrdemServicoTv) => void;
};

export function TvOsCard({
  ordem,
  index,
  isOverlay = false,
  onAbrirResumo,
}: Props) {
  const tempoEtapa = useEtapaTempo(ordem.etapaDesde);
  const isNova = useTvDashboardStore((s) => s.novasOsIds.includes(ordem.id));
  const categoriaPrazo = classificarPrazoTv(ordem);
  const estiloPrazo = estilosCardPrazoTv(categoriaPrazo);

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
      className={cn(
        "p-3 tv:p-3.5 tv-4k:p-4",
        TV_OS_CARD,
        estiloPrazo.border,
        estiloPrazo.ring,
        estiloPrazo.bg,
        estiloPrazo.shadow,
        categoriaPrazo === "atrasada" && "tv-atrasada-pulse",
        isNova && "ring-offset-1 ring-offset-[#070b12]",
        !isOverlay && "hover:brightness-110"
      )}
    >
      <div
        {...(isOverlay ? {} : { ...listeners, ...attributes })}
        className={cn(
          "mb-2.5 flex cursor-grab items-start justify-between gap-2 active:cursor-grabbing",
          isOverlay && "cursor-default"
        )}
      >
        <span className="font-tv-mono text-sm font-bold text-white tv:text-base">
          OS {ordem.numeroOs}
        </span>
        <TvBadge prioridade={ordem.prioridade} />
      </div>

      <button
        type="button"
        disabled={isOverlay || !onAbrirResumo}
        onClick={() => onAbrirResumo?.(ordem)}
        className={cn(
          "w-full space-y-1.5 rounded-lg text-left text-[11px] transition tv:text-xs tv-4k:text-sm",
          !isOverlay &&
            onAbrirResumo &&
            "cursor-pointer hover:bg-slate-800/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500/50",
          (isOverlay || !onAbrirResumo) && "cursor-default"
        )}
      >
        <p className="truncate font-semibold text-slate-100">{ordem.paciente}</p>
        <p className="truncate text-slate-400">{ordem.dentista}</p>
        <p className={cn("font-medium", estiloPrazo.prazo)}>
          Prazo {ordem.prazo}
          {" · "}
          {labelPrazoCard(categoriaPrazo)}
        </p>
        <p className="font-tv-mono text-[10px] text-violet-300/80 tv:text-[11px]">
          {tempoEtapa} na etapa
        </p>
        <p className="text-slate-500">
          Resp. <span className="text-slate-300">{ordem.colaborador}</span>
        </p>
      </button>

      <p className="mt-2.5 truncate rounded-md bg-slate-800/60 px-2 py-1 text-[10px] text-slate-400 tv:text-[11px]">
        {ordem.status}
      </p>
    </motion.article>
  );
}
