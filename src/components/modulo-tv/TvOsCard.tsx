"use client";

import { useRef } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
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
import { cn, temColaborador } from "@/lib/utils";

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
  const ignorarProximoClique = useRef(false);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } =
    useDraggable({
      id: ordem.id,
      data: { type: "ordem", coluna: ordem.coluna, ordem },
      disabled: isOverlay,
    });

  // Card também é droppable → soltar em cima de outro card muda para a coluna dele.
  const { setNodeRef: setDropRef } = useDroppable({
    id: isOverlay ? `overlay-${ordem.id}` : `drop-${ordem.id}`,
    data: { type: "ordem", coluna: ordem.coluna, ordem },
    disabled: isOverlay,
  });

  function setRefs(node: HTMLElement | null) {
    setDragRef(node);
    setDropRef(node);
  }

  if (isDragging) {
    ignorarProximoClique.current = true;
  }

  return (
    <motion.article
      ref={isOverlay ? undefined : setRefs}
      layout={!isDragging && !isOverlay}
      initial={{ opacity: 0, y: 10 }}
      animate={{
        // Com DragOverlay: original fica no lugar (opacidade 0), sem transform.
        opacity: isDragging && !isOverlay ? 0 : 1,
        y: 0,
        scale: isNova && !isDragging ? [1, 1.02, 1] : 1,
      }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, delay: isOverlay ? 0 : index * 0.02 }}
      whileHover={isOverlay || isDragging ? undefined : { y: -1 }}
      {...(isOverlay ? {} : { ...listeners, ...attributes })}
      onClick={() => {
        if (isOverlay || !onAbrirResumo) return;
        if (ignorarProximoClique.current) {
          ignorarProximoClique.current = false;
          return;
        }
        onAbrirResumo(ordem);
      }}
      className={cn(
        "p-3 tv:p-3.5 tv-4k:p-4",
        TV_OS_CARD,
        estiloPrazo.border,
        estiloPrazo.ring,
        estiloPrazo.bg,
        estiloPrazo.shadow,
        categoriaPrazo === "atrasada" && "tv-atrasada-pulse",
        isNova && "ring-offset-1 ring-offset-[#070b12]",
        !isOverlay && "cursor-grab hover:brightness-110 active:cursor-grabbing",
        isOverlay && "cursor-default",
        isDragging && !isOverlay && "pointer-events-none"
      )}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <span className="font-tv-mono text-sm font-bold text-white tv:text-base">
          OS {ordem.numeroOs}
        </span>
        <TvBadge prioridade={ordem.prioridade} />
      </div>

      <div className="w-full space-y-1.5 text-left text-[11px] tv:text-xs tv-4k:text-sm">
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
        {temColaborador(ordem.colaborador) ? (
          <p className="text-slate-500">
            Resp. <span className="text-slate-300">{ordem.colaborador}</span>
          </p>
        ) : null}
      </div>

      <p className="mt-2.5 truncate rounded-md bg-slate-800/60 px-2 py-1 text-[10px] text-slate-400 tv:text-[11px]">
        {ordem.status}
      </p>
    </motion.article>
  );
}
