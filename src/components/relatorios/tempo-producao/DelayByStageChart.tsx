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
import { useI18n } from "@/components/i18n-provider";
import type { GraficosTempoProducao } from "@/lib/tempo-producao-relatorio";

type Props = {
  dados: GraficosTempoProducao["atrasoPorEtapa"];
};

export function DelayByStageChart({ dados }: Props) {
  const { t } = useI18n();
  const chartData = dados.length ? dados : [{ etapa: t("relatorio.comum.semDados"), dias: 0, os: 0 }];

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
      <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {t("relatorio.tempo.graficoAtrasoEtapa")}
      </h3>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{t("relatorio.tempo.graficoAtrasoEtapaSub")}</p>
      <div className="h-[260px] w-full tv:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="etapa"
              tick={{ fontSize: 10, fill: "#64748b" }}
              angle={-25}
              textAnchor="end"
              interval={0}
              height={60}
            />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(value, _name, item) => [
                t("relatorio.tempo.tooltipAtraso", {
                  dias: Number(value ?? 0),
                  os: item?.payload?.os ?? 0,
                }),
                t("relatorio.tempo.atrasoMedio"),
              ]}
            />
            <Bar dataKey="dias" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
