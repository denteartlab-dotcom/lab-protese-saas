"use client";

import type { ReactNode } from "react";
import { Calendar, Users } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useI18n } from "@/components/i18n-provider";
import { TV_SIDEBAR_CARD, TV_TEXT_LABEL } from "@/components/modulo-tv/tv-styles";
import type { TvDashboardStats, ColaboradorTv } from "@/components/modulo-tv/types";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  stats: TvDashboardStats;
  colaboradores: ColaboradorTv[];
  children?: ReactNode;
};

const DONUT_CORES = [
  { key: "atrasadas", cor: "#ef4444", labelKey: "producao.tv.donut.atrasadas" as MessageKey },
  { key: "prazoHoje", cor: "#eab308", labelKey: "producao.tv.donut.hoje" as MessageKey },
  { key: "prazoAmanha", cor: "#3b82f6", labelKey: "producao.tv.donut.amanha" as MessageKey },
  {
    key: "prazoAposAmanha",
    cor: "#8b5cf6",
    labelKey: "producao.tv.donut.aposAmanha" as MessageKey,
  },
] as const;

export function TvSidebar({ stats, colaboradores, children }: Props) {
  const { t } = useI18n();
  const colaboradoresOnline = colaboradores.filter((c) => c.online);
  const donutData = DONUT_CORES.map((d) => ({
    name: t(d.labelKey),
    value: Math.max(0, stats[d.key]),
    fill: d.cor,
  })).filter((d) => d.value > 0);

  const donutFallback =
    donutData.length > 0
      ? donutData
      : [{ name: t("producao.tv.osAtivas"), value: 1, fill: "#3b82f6" }];

  return (
    <aside className="flex h-full min-h-0 w-[16vw] min-w-[156px] max-w-[210px] shrink-0 flex-col gap-1.5 overflow-hidden tv-hd:min-w-[168px] tv-hd:max-w-[220px] tv:w-[14vw] tv:max-w-[240px] tv:gap-2">
      {children}

      <div className={cn("shrink-0 p-2.5 tv:p-3", TV_SIDEBAR_CARD)}>
        <p className={cn("mb-1.5", TV_TEXT_LABEL)}>{t("producao.tv.resumoGeral")}</p>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-tv-mono text-2xl font-bold leading-none tabular-nums text-white tv:text-3xl">
              {stats.totalProducao}
            </p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {t("producao.tv.osAtivas")}
            </p>
          </div>
          <div className="h-16 w-16 shrink-0 tv:h-[72px] tv:w-[72px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutFallback}
                  cx="50%"
                  cy="50%"
                  innerRadius="48%"
                  outerRadius="78%"
                  paddingAngle={2}
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
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
          {DONUT_CORES.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-1 text-[9px] tv:text-[10px]"
            >
              <span className="flex min-w-0 items-center gap-1 truncate text-slate-400">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.cor }}
                />
                <span className="truncate">{t(item.labelKey)}</span>
              </span>
              <span
                className="font-tv-mono shrink-0 font-semibold tabular-nums"
                style={{ color: item.cor }}
              >
                {stats[item.key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={cn("shrink-0 p-2.5 tv:p-3", TV_SIDEBAR_CARD)}>
        <div className="mb-1 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-amber-400" />
          <p className={TV_TEXT_LABEL}>{t("producao.tv.entregasHoje")}</p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="font-tv-mono text-2xl font-bold leading-none tabular-nums text-white tv:text-3xl">
            {stats.entregasHoje}
          </p>
          <p className="text-[10px] font-semibold text-emerald-400">
            {stats.entregasConcluidas}{" "}
            {stats.entregasConcluidas === 1
              ? t("producao.tv.concluida")
              : t("producao.tv.concluidas")}
          </p>
        </div>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-hidden p-2.5 tv:p-3", TV_SIDEBAR_CARD)}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-violet-400" />
            <p className={TV_TEXT_LABEL}>{t("producao.comum.colaboradores")}</p>
          </div>
          <p className="font-tv-mono text-lg font-bold tabular-nums text-white">
            {stats.colaboradoresOnline}
          </p>
        </div>
        {colaboradoresOnline.length > 0 ? (
          <ul className="space-y-1 overflow-hidden">
            {colaboradoresOnline.slice(0, 4).map((colab) => (
              <li
                key={colab.id}
                className="flex items-center gap-1.5 text-[10px] text-slate-300 tv:text-[11px]"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span className="truncate">{colab.nome}</span>
              </li>
            ))}
            {colaboradoresOnline.length > 4 ? (
              <li className="text-[10px] text-slate-500">
                +{colaboradoresOnline.length - 4}
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-[10px] text-slate-500">
            {t("producao.tv.semUsuariosOnline")}
          </p>
        )}
      </div>
    </aside>
  );
}
