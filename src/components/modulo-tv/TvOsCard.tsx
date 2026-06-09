"use client";

import { motion } from "framer-motion";
import { CalendarClock, Stethoscope, User } from "lucide-react";
import { TvBadge } from "@/components/modulo-tv/ui/TvBadge";
import type { OrdemServicoTv } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

const BORDA_PRIORIDADE: Record<OrdemServicoTv["prioridade"], string> = {
  urgente: "border-l-red-500 shadow-[0_0_20px_rgba(239,68,68,0.12)]",
  alta: "border-l-orange-500 shadow-[0_0_16px_rgba(249,115,22,0.1)]",
  normal: "border-l-sky-500/80",
  baixa: "border-l-slate-600",
};

type Props = {
  ordem: OrdemServicoTv;
  index: number;
};

export function TvOsCard({ ordem, index }: Props) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, delay: index * 0.03 }}
      whileHover={{
        scale: 1.02,
        boxShadow: "0 8px 32px rgba(56, 189, 248, 0.12)",
      }}
      className={cn(
        "group cursor-default rounded-xl border border-slate-700/50 border-l-[3px] bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-3 backdrop-blur-sm transition-colors 2xl:p-3.5",
        BORDA_PRIORIDADE[ordem.prioridade],
        ordem.atrasada && "ring-1 ring-red-500/40"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="rounded-md bg-slate-800/80 px-2 py-1 text-sm font-bold tabular-nums text-white 2xl:text-base">
          OS {ordem.numeroOs}
        </span>
        <TvBadge prioridade={ordem.prioridade} />
      </div>

      <div className="space-y-1.5 text-[11px] text-slate-300 2xl:text-xs">
        <p className="flex items-center gap-1.5 font-medium text-slate-100">
          <User className="h-3.5 w-3.5 shrink-0 text-cyan-400/80" />
          <span className="truncate">{ordem.paciente}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Stethoscope className="h-3.5 w-3.5 shrink-0 text-violet-400/80" />
          <span className="truncate">{ordem.dentista}</span>
        </p>
        <p
          className={cn(
            "flex items-center gap-1.5",
            ordem.atrasada ? "font-semibold text-red-400" : "text-slate-400"
          )}
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          Prazo {ordem.prazo}
          {ordem.atrasada ? " · ATRASADA" : ""}
        </p>
      </div>

      <p className="mt-2 truncate rounded bg-slate-800/50 px-2 py-1 text-[10px] text-slate-400 2xl:text-[11px]">
        {ordem.status}
      </p>
    </motion.article>
  );
}
