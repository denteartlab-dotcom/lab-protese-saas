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
    <div className={cn("flex flex-col p-3 tv:p-4", TV_GLASS_CARD)}>
      <p className={cn("mb-2", TV_TEXT_LABEL)}>Fluxo em tempo real</p>
      <div className="h-24 w-full">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="pronto_entrega" stroke="#14b8a6" fill="rgba(20,184,166,0.1)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-slate-500">
            Aguardando dados...
          </div>
        )}
      </div>
    </div>
  );
}
