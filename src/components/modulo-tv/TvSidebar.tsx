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
import type { TvDashboardStats } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

type Props = {
  stats: TvDashboardStats;
};

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={cn(
        "rounded-xl border border-slate-700/50 bg-slate-900/60 p-3 backdrop-blur-sm 2xl:p-4",
        tone
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 2xl:text-[11px]">
          {label}
        </span>
        <span className="text-slate-500">{icon}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-white 2xl:text-3xl">
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

  return (
    <aside className="flex w-[200px] shrink-0 flex-col gap-2 2xl:w-[240px] 3xl:w-[260px]">
      <StatCard
        icon={<ClipboardList className="h-4 w-4 text-cyan-400" />}
        label="OS em produção"
        value={stats.totalProducao}
        tone="shadow-[inset_0_0_20px_rgba(34,211,238,0.06)]"
      />
      <StatCard
        icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
        label="Atrasadas"
        value={stats.atrasadas}
        tone="shadow-[inset_0_0_20px_rgba(239,68,68,0.08)]"
      />
      <StatCard
        icon={<CalendarCheck className="h-4 w-4 text-emerald-400" />}
        label="Entregas hoje"
        value={stats.entregasHoje}
        tone="shadow-[inset_0_0_20px_rgba(16,185,129,0.08)]"
      />
      <StatCard
        icon={<Users className="h-4 w-4 text-violet-400" />}
        label="Colaboradores online"
        value={stats.colaboradoresOnline}
        tone="shadow-[inset_0_0_20px_rgba(139,92,246,0.08)]"
      />

      <div className="mt-1 flex flex-1 flex-col rounded-xl border border-slate-700/50 bg-slate-900/60 p-3 2xl:p-4">
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Conclusão do dia
        </p>
        <div className="relative mx-auto h-28 w-full 2xl:h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                <Cell fill="#22d3ee" />
                <Cell fill="#1e293b" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-cyan-300 2xl:text-2xl">
              {stats.percentualConcluido}%
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 text-[10px] 2xl:text-[11px]">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            Concluídas
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-600" />
            Em andamento
          </div>
        </div>
      </div>
    </aside>
  );
}
