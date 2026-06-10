"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GraficosTempoProducao } from "@/lib/tempo-producao-relatorio";

type Props = {
  tempoMedio: GraficosTempoProducao["tempoMedioPorColaborador"];
  rankingAtraso?: GraficosTempoProducao["rankingColaboradoresAtraso"];
};

export function CollaboratorPerformanceChart({ tempoMedio }: Props) {
  const chartData = tempoMedio.length ? tempoMedio : [{ colaborador: "Sem dados", dias: 0 }];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
        <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Tempo médio parado por colaborador</h3>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Média de dias na etapa atual</p>
        <div className="h-[240px] w-full tv:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis
                type="category"
                dataKey="colaborador"
                width={100}
                tick={{ fontSize: 10, fill: "#64748b" }}
              />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="dias" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
