"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { TvCardSkeleton } from "@/components/modulo-tv/ui/TvSkeleton";
import { TvOsCard } from "@/components/modulo-tv/TvOsCard";
import { TV_COLUMN } from "@/components/modulo-tv/tv-styles";
import type { ColunaKanbanConfig, OrdemServicoTv } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

type Props = {
  coluna: ColunaKanbanConfig;
  ordens: OrdemServicoTv[];
  carregando: boolean;
  onAbrirResumo?: (ordem: OrdemServicoTv) => void;
};

export function TvKanbanColumn({
  coluna,
  ordens,
  carregando,
  onAbrirResumo,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: coluna.id,
    data: { type: "coluna", coluna: coluna.id },
  });

  return (
    <motion.section
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "flex h-full min-w-0 w-full flex-col overflow-hidden p-1.5 tv-hd:p-2 tv:p-2.5",
        TV_COLUMN,
        coluna.border,
        coluna.glow,
        isOver && "ring-1 ring-blue-400/40"
      )}
    >
      <div className={cn("mb-2 h-0.5 w-full rounded-full bg-gradient-to-r", coluna.bar)} />

      <header className="mb-2 flex shrink-0 items-center justify-between gap-2 px-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", coluna.dot)} />
          <h3 className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-slate-200 tv:text-[11px] tv-4k:text-xs">
            {coluna.label}
          </h3>
        </div>
        <motion.span
          key={ordens.length}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className={cn(
            "inline-flex min-w-[1.75rem] items-center justify-center rounded-md px-2 py-0.5 font-tv-mono text-xs font-bold tabular-nums tv:text-sm",
            coluna.badge
          )}
        >
          {ordens.length}
        </motion.span>
      </header>

      <div
        ref={setNodeRef}
        className="tv-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="flex flex-col gap-2 pb-1 tv:gap-2.5">
          {carregando
            ? Array.from({ length: Math.max(2, ordens.length) }).map((_, i) => (
                <TvCardSkeleton key={`sk-${coluna.id}-${i}`} />
              ))
            : null}
          {!carregando ? (
            <AnimatePresence mode="popLayout">
              {ordens.map((ordem, index) => (
                <TvOsCard
                  key={ordem.id}
                  ordem={ordem}
                  index={index}
                  onAbrirResumo={onAbrirResumo}
                />
              ))}
            </AnimatePresence>
          ) : null}
          {!carregando && ordens.length === 0 ? (
            <p className="py-8 text-center text-[10px] text-slate-600 tv:text-[11px]">
              —
            </p>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
