"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { TvCardSkeleton } from "@/components/modulo-tv/ui/TvSkeleton";
import { TvOsCard } from "@/components/modulo-tv/TvOsCard";
import type { ColunaKanbanConfig, OrdemServicoTv } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

type Props = {
  coluna: ColunaKanbanConfig;
  ordens: OrdemServicoTv[];
  carregando: boolean;
};

export function TvKanbanColumn({ coluna, ordens, carregando }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: coluna.id,
    data: { coluna: coluna.id },
  });

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-gradient-to-b p-2.5 transition-shadow duration-300 tv:p-3 tv-4k:p-4",
        coluna.border,
        coluna.accent,
        coluna.glow,
        coluna.ring,
        "ring-1",
        isOver && "ring-2 ring-cyan-400/40 shadow-[0_0_40px_rgba(34,211,238,0.2)]"
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          coluna.bar
        )}
      />

      <header className="mb-2.5 flex shrink-0 items-center justify-between gap-2 px-1 pt-1 tv:mb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full tv:h-2.5 tv:w-2.5",
              coluna.dot
            )}
          />
          <h3 className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-slate-100 tv:text-xs tv-4k:text-sm">
            {coluna.label}
          </h3>
        </div>
        <motion.span
          key={ordens.length}
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className={cn(
            "inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-1 font-tv-mono text-sm font-bold tabular-nums tv:text-base tv-4k:text-lg",
            coluna.badge
          )}
        >
          {ordens.length}
        </motion.span>
      </header>

      <div
        ref={setNodeRef}
        className="tv-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5"
      >
        <div className="flex flex-col gap-2 pb-1 tv:gap-2.5 tv-4k:gap-3">
          {carregando
            ? Array.from({ length: Math.max(2, ordens.length) }).map((_, i) => (
                <TvCardSkeleton key={`sk-${coluna.id}-${i}`} />
              ))
            : null}
          {!carregando ? (
            <AnimatePresence mode="popLayout">
              {ordens.map((ordem, index) => (
                <TvOsCard key={ordem.id} ordem={ordem} index={index} />
              ))}
            </AnimatePresence>
          ) : null}
          {!carregando && ordens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-2 h-8 w-8 rounded-full border border-dashed border-white/10 bg-white/[0.02]" />
              <p className="text-[11px] font-medium text-slate-500 tv:text-xs">
                Nenhuma OS nesta etapa
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
