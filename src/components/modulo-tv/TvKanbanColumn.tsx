"use client";

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
  return (
    <motion.section
      layout
      className={cn(
        "flex h-full min-w-0 flex-1 flex-col rounded-2xl border bg-gradient-to-b p-2 2xl:p-3",
        coluna.border,
        coluna.accent,
        coluna.glow
      )}
    >
      <header className="mb-2 flex shrink-0 items-center justify-between gap-2 px-1">
        <h3 className="truncate text-xs font-bold uppercase tracking-wide text-slate-200 2xl:text-sm">
          {coluna.label}
        </h3>
        <motion.span
          key={ordens.length}
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ring-1 2xl:text-base",
            coluna.badge
          )}
        >
          {ordens.length}
        </motion.span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5 scrollbar-thin">
        <div className="flex flex-col gap-2 pb-1">
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
            <p className="py-8 text-center text-[11px] text-slate-500">
              Nenhuma OS nesta etapa
            </p>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
