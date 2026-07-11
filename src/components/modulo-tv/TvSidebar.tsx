"use client";

import { motion } from "framer-motion";
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

export function TvSidebar({ stats, colaboradores }: Props) {
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
    <aside className="tv-scrollbar flex w-[17vw] min-w-[168px] max-w-[220px] shrink-0 flex-col gap-2 overflow-y-auto tv-hd:min-w-[180px] tv-hd:max-w-[240px] tv-hd:gap-2.5 tv:w-[15vw] tv:max-w-[280px] tv:gap-3">
      {/* CARD 1 — RESUMO GERAL */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn("p-4 tv:p-5 tv-4k:p-6", TV_SIDEBAR_CARD)}
      >
        <p className={cn("mb-3", TV_TEXT_LABEL)}>{t("producao.tv.resumoGeral")}</p>

        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 tv:text-[11px]">
          {t("producao.tv.totalProducao")}
        </p>
        <p className="font-tv-mono text-4xl font-bold tabular-nums text-white tv:text-5xl tv-4k:text-6xl">
          {stats.totalProducao}
        </p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 tv:text-[11px]">
          {t("producao.tv.osAtivas")}
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
                {t(item.labelKey)}
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
          <p className={TV_TEXT_LABEL}>{t("producao.tv.entregasHoje")}</p>
        </div>
        <p className="font-tv-mono text-4xl font-bold tabular-nums text-white tv:text-5xl tv-4k:text-6xl">
          {stats.entregasHoje}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 tv:text-[11px]">
          {t("producao.controle.tabela.os")}
        </p>
        <p className="mt-2 text-[11px] font-semibold text-emerald-400 tv:text-xs">
          {stats.entregasConcluidas}{" "}
          {stats.entregasConcluidas === 1
            ? t("producao.tv.concluida")
            : t("producao.tv.concluidas")}
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
          <p className={TV_TEXT_LABEL}>{t("producao.comum.colaboradores")}</p>
        </div>
        <p className="font-tv-mono text-4xl font-bold tabular-nums text-white tv:text-5xl tv-4k:text-6xl">
          {stats.colaboradoresOnline}
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 tv:text-[11px]">
          {t("producao.tv.ativosAgora")}
        </p>
        {colaboradoresOnline.length > 0 ? (
          <ul className="mt-3 max-h-[140px] space-y-1.5 overflow-y-auto tv:max-h-[180px]">
            {colaboradoresOnline.map((colab) => (
              <li
                key={colab.id}
                className="flex items-center gap-2 text-[11px] text-slate-300 tv:text-xs"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                <span className="truncate">{colab.nome}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-slate-500 tv:text-xs">
            {t("producao.tv.semUsuariosOnline")}
          </p>
        )}
      </motion.div>
    </aside>
  );
}
