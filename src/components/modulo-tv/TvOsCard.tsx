"use client";

import { motion } from "framer-motion";
import { CalendarClock, Stethoscope, User } from "lucide-react";
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
};

export function TvOsCard({ ordem, index }: Props) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{
        duration: 0.4,
        delay: index * 0.025,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{
        y: -2,
        transition: { duration: 0.25 },
      }}
      className={cn(
        "group relative cursor-default overflow-hidden border-l-[3px] p-3 tv:p-3.5 tv-4k:p-4",
        TV_GLASS_CARD,
        BORDA_PRIORIDADE[ordem.prioridade],
        ordem.atrasada && "ring-1 ring-red-500/35",
        "transition-shadow duration-300 hover:border-white/[0.12] hover:shadow-[0_8px_40px_rgba(59,130,246,0.12),0_0_24px_rgba(139,92,246,0.08)]"
      )}
    >
      {/* Shine sutil no hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative mb-2.5 flex items-start justify-between gap-2">
        <span className="rounded-lg border border-white/[0.08] bg-white/[0.06] px-2.5 py-1 font-tv-mono text-sm font-bold tabular-nums text-white backdrop-blur-sm tv:text-base tv-4k:text-lg">
          OS {ordem.numeroOs}
        </span>
        <TvBadge prioridade={ordem.prioridade} />
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
        <p
          className={cn(
            "flex items-center gap-2",
            ordem.atrasada
              ? "font-semibold text-red-400"
              : "text-slate-400"
          )}
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0 tv:h-4 tv:w-4" />
          <span className="truncate">
            Prazo {ordem.prazo}
            {ordem.atrasada ? " · ATRASADA" : ""}
          </span>
        </p>
      </div>

      <p className="relative mt-2.5 truncate rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-1.5 text-[10px] font-medium text-slate-400 tv:text-[11px] tv-4k:text-xs">
        {ordem.status}
      </p>
    </motion.article>
  );
}
