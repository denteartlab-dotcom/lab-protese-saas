"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarCheck,
  ClipboardList,
  Users,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { TV_GLASS_CARD, TV_TEXT_LABEL } from "@/components/modulo-tv/tv-styles";
import type { TvDashboardStats } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

type Props = {
  stats: TvDashboardStats;
};

const STAT_ACCENTS = [
  {
    bar: "from-cyan-400 to-blue-500",
    glow: "shadow-[0_0_28px_rgba(34,211,238,0.1)]",
    icon: "text-cyan-400",
  },
  {
    bar: "from-red-400 to-rose-500",
    glow: "shadow-[0_0_28px_rgba(239,68,68,0.12)]",
    icon: "text-red-400",
  },
  {
    bar: "from-emerald-400 to-teal-500",
    glow: "shadow-[0_0_28px_rgba(16,185,129,0.1)]",
    icon: "text-emerald-400",
  },
  {
    bar: "from-violet-400 to-purple-500",
    glow: "shadow-[0_0_28px_rgba(139,92,246,0.12)]",
    icon: "text-violet-400",
  },
] as const;

function StatCard({
  icon,
  label,
  value,
  accent,
  index,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  accent: (typeof STAT_ACCENTS)[number];
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: "easeOut" }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={cn(
        "relative overflow-hidden p-3.5 tv:p-4 tv-4k:p-5",
        TV_GLASS_CARD,
        accent.glow
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-1 bg-gradient-to-b",
          accent.bar
        )}
      />
      <div className="mb-2.5 flex items-center justify-between pl-2">
        <span className={TV_TEXT_LABEL}>{label}</span>
        <span className={accent.icon}>{icon}</span>
      </div>
      <p className="pl-2 font-tv-mono text-2xl font-bold tabular-nums tracking-tight text-white tv:text-3xl tv-4k:text-4xl">
        {value}
      </p>
    </motion.div>
  );
}

export function TvSidebar({ stats }: Props) {
  const chartData = [
    { name: "Concluído", value: stats.percentualConcluido },
    { name: "Restante", value: 100 - stats.percentualConcluido },
  ];

  const statItems = [
    {
      icon: <ClipboardList className="h-4 w-4 tv:h-5 tv:w-5" />,
      label: "OS em produção",
      value: stats.totalProducao,
    },
    {
      icon: <AlertTriangle className="h-4 w-4 tv:h-5 tv:w-5" />,
      label: "Atrasadas",
      value: stats.atrasadas,
    },
    {
      icon: <CalendarCheck className="h-4 w-4 tv:h-5 tv:w-5" />,
      label: "Entregas hoje",
      value: stats.entregasHoje,
    },
    {
      icon: <Users className="h-4 w-4 tv:h-5 tv:w-5" />,
      label: "Colaboradores",
      value: stats.colaboradoresOnline,
    },
  ];

  return (
    <aside className="flex w-[210px] shrink-0 flex-col gap-2.5 tv:w-[260px] tv:gap-3 tv-4k:w-[300px] tv-4k:gap-3.5">
      {statItems.map((item, i) => (
        <StatCard
          key={item.label}
          icon={item.icon}
          label={item.label}
          value={item.value}
          accent={STAT_ACCENTS[i]}
          index={i}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.28 }}
        className={cn(
          "mt-0.5 flex flex-1 flex-col p-3.5 tv:p-4 tv-4k:p-5",
          TV_GLASS_CARD,
          "shadow-[0_0_40px_rgba(59,130,246,0.08)]"
        )}
      >
        <p className={cn("mb-3 text-center", TV_TEXT_LABEL)}>
          Conclusão do dia
        </p>
        <div className="relative mx-auto h-28 w-full tv:h-36 tv-4k:h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                <Cell fill="url(#tvPieGradient)" />
                <Cell fill="rgba(30,41,59,0.8)" />
              </Pie>
              <defs>
                <linearGradient id="tvPieGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="font-tv-mono text-xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 to-violet-300 tv:text-2xl tv-4k:text-3xl">
              {stats.percentualConcluido}%
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-[10px] tv:text-[11px] tv-4k:text-xs">
          <div className="flex items-center gap-2.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
            Concluídas
          </div>
          <div className="flex items-center gap-2.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-600/80" />
            Em andamento
          </div>
        </div>
      </motion.div>
    </aside>
  );
}
