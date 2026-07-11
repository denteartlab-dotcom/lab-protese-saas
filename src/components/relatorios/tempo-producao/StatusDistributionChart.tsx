"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useI18n } from "@/components/i18n-provider";
import { InfoTooltip } from "@/components/relatorios/tempo-producao/InfoTooltip";
import { tooltipTempo } from "@/components/relatorios/tempo-producao/tempo-i18n";
import type { GraficosTempoProducao } from "@/lib/tempo-producao-relatorio";

type Props = {
  distribuicao: GraficosTempoProducao["distribuicaoStatus"];
};

export function StatusDistributionChart({ distribuicao }: Props) {
  const { t } = useI18n();
  const pieData = distribuicao.filter((d) => d.quantidade > 0);
  const chartPie = pieData.length
    ? pieData
    : [{ label: t("relatorio.comum.semDados"), quantidade: 1, cor: "#e2e8f0", status: "em_dia" as const }];

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t("relatorio.tempo.distribuicaoStatus")}
        </h3>
        <InfoTooltip texto={tooltipTempo("status", t)} />
      </div>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{t("relatorio.tempo.distribuicaoStatusSub")}</p>
      <div className="h-[280px] w-full tv:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartPie}
              dataKey="quantidade"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={88}
              paddingAngle={2}
            >
              {chartPie.map((entry, i) => (
                <Cell key={`${entry.label}-${i}`} fill={entry.cor} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                fontSize: 12,
                backgroundColor: "var(--tooltip-bg, #fff)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {distribuicao.map((d) => (
          <span key={d.status} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.cor }} />
            {d.label}: {d.quantidade}
          </span>
        ))}
      </div>
    </div>
  );
}
