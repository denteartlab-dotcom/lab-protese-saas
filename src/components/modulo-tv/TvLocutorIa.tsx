"use client";

import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useLocutorTv } from "@/components/modulo-tv/hooks/useLocutorTv";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import { TV_SIDEBAR_CARD, TV_TEXT_LABEL } from "@/components/modulo-tv/tv-styles";
import type { OrdemServicoTv } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

type Props = {
  ordens: OrdemServicoTv[];
  dadosCarregados: boolean;
};

export function TvLocutorIa({ ordens, dadosCarregados }: Props) {
  const { t } = useI18n();
  const locutorIaAtivo = useTvDashboardStore((s) => s.locutorIaAtivo);
  const setLocutorIaAtivo = useTvDashboardStore((s) => s.setLocutorIaAtivo);
  const { falando, ttsDisponivel, aoLigar, falarAgora } = useLocutorTv(
    ordens,
    dadosCarregados
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className={cn("shrink-0 p-2.5 tv:p-3", TV_SIDEBAR_CARD)}
    >
      <p className={cn("mb-1.5", TV_TEXT_LABEL)}>{t("producao.tv.locutor.titulo")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (locutorIaAtivo) {
              setLocutorIaAtivo(false);
              return;
            }
            setLocutorIaAtivo(true);
            void aoLigar();
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition tv:text-xs",
            locutorIaAtivo
              ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
              : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white"
          )}
        >
          <Volume2 className="h-3.5 w-3.5" />
          {locutorIaAtivo
            ? t("producao.tv.locutor.ativo")
            : t("producao.tv.locutor.ativar")}
        </button>
        <button
          type="button"
          onClick={() => void falarAgora()}
          disabled={!ttsDisponivel || falando}
          className="inline-flex items-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-cyan-400/30 hover:text-white disabled:opacity-50 tv:text-xs"
        >
          {falando
            ? t("producao.tv.locutor.falando")
            : t("producao.tv.locutor.falarAgora")}
        </button>
      </div>
    </motion.div>
  );
}
