"use client";

import { motion } from "framer-motion";
import { Calendar, Users } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { TV_SIDEBAR_CARD, TV_TEXT_LABEL } from "@/components/modulo-tv/tv-styles";
import type { TvDashboardStats } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

type Props = {
  stats: TvDashboardStats;
};

const DONUT_CORES = [
  { key: "atrasadas", cor: "#ef4444", label: "Atrasadas" },
  { key: "prazoHoje", cor: "#eab308", label: "Hoje" },
  { key: "prazoAmanha", cor: "#3b82f6", label: "Amanhã" },
  { key: "prazoAposAmanha", cor: "#8b5cf6", label: "Após Amanhã" },
] as const;

export function TvSidebar({ stats }: Props) {
  const donutData = DONUT_CORES.map((d) => ({
    name: d.label,
    value: Math.max(0, stats[d.key]),
    fill: d.cor,
  })).filter((d) => d.value > 0);

  const donutFallback =
    donutData.length > 0
      ? donutData
      : [{ name: "Ativas", value: 1, fill: "#3b82f6" }];

  return (
    <aside className="tv-scrollbar flex w-[17vw] min-w-[168px] max-w-[220px] shrink-0 flex-col gap-2 overflow-y-auto tv-hd:min-w-[180px] tv-hd:max-w-[240px] tv-hd:gap-2.5 tv:w-[15vw] tv:max-w-[280px] tv:gap-3">
      {/* CARD 1 — RESUMO GERAL */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn("p-4 tv:p-5 tv-4k:p-6", TV_SIDEBAR_CARD)}
      >
        <p className={cn("mb-3", TV_TEXT_LABEL)}>Resumo Geral</p>

        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 tv:text-[11px]">
          Total em Produção
        </p>
        <p className="font-tv-mono text-4xl font-bold tabular-nums text-white tv:text-5xl tv-4k:text-6xl">
          {stats.totalProducao}
        </p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 tv:text-[11px]">
          OS Ativas
        </p>

        <div className="relative mx-auto mt-4 h-[120px] w-full tv:h-[140px] tv-4k:h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutFallback}
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="78%"
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {donutFallback.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 space-y-2">
          {DONUT_CORES.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between text-[10px] tv:text-[11px]"
            >
              <span className="flex items-center gap-2 text-slate-400">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.cor }}
                />
                {item.label}
              </span>
              <span
                className="font-tv-mono font-semibold tabular-nums"
                style={{ color: item.cor }}
              >
                {stats[item.key]}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* CARD 2 — ENTREGAS HOJE */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.08 }}
        className={cn("p-4 tv:p-5 tv-4k:p-6", TV_SIDEBAR_CARD)}
      >
        <div className="mb-2 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-amber-400 tv:h-5 tv:w-5" />
          <p className={TV_TEXT_LABEL}>Entregas Hoje</p>
        </div>
        <p className="font-tv-mono text-4xl font-bold tabular-nums text-white tv:text-5xl tv-4k:text-6xl">
          {stats.entregasHoje}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 tv:text-[11px]">
          OS
        </p>
        <p className="mt-2 text-[11px] font-semibold text-emerald-400 tv:text-xs">
          {stats.entregasConcluidas}{" "}
          {stats.entregasConcluidas === 1 ? "concluída" : "concluídas"}
        </p>
      </motion.div>

      {/* CARD 3 — COLABORADORES */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.16 }}
        className={cn("p-4 tv:p-5 tv-4k:p-6", TV_SIDEBAR_CARD)}
      >
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-400 tv:h-5 tv:w-5" />
          <p className={TV_TEXT_LABEL}>Colaboradores</p>
        </div>
        <p className="font-tv-mono text-4xl font-bold tabular-nums text-white tv:text-5xl tv-4k:text-6xl">
          {stats.colaboradoresOnline}
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 tv:text-[11px]">
          Ativos agora
        </p>
      </motion.div>
    </aside>
  );
}
