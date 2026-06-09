"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TV_GLASS_CARD, TV_TEXT_LABEL } from "@/components/modulo-tv/tv-styles";
import type { TvChartPoint } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

type Props = {
  pontos: TvChartPoint[];
};

export function TvRealtimeChart({ pontos }: Props) {
  const data = pontos.length ? pontos : [];

  return (
    <div className={cn("flex flex-col p-3 tv:p-4 tv-4k:p-5", TV_GLASS_CARD)}>
      <p className={cn("mb-2", TV_TEXT_LABEL)}>Fluxo em tempo real</p>
      <div className="h-24 w-full tv:h-28 tv-4k:h-32">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tvAreaCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tvAreaViolet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#94a3b8", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#22d3ee"
                fill="url(#tvAreaCyan)"
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={600}
              />
              <Area
                type="monotone"
                dataKey="pronto"
                stroke="#8b5cf6"
                fill="url(#tvAreaViolet)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-slate-500">
            Aguardando dados...
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-3 text-[9px] text-slate-500 tv:text-[10px]">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-3 rounded-full bg-cyan-400" />
          Total OS
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-3 rounded-full bg-violet-400" />
          Prontas
        </span>
      </div>
    </div>
  );
}
