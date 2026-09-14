"use client";

import { motion } from "framer-motion";
import { Bot, Volume2 } from "lucide-react";
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
  const { resumo, falando, ultimaFala, precisaToque, ttsDisponivel, falarAgora } =
    useLocutorTv(ordens, dadosCarregados);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className={cn("p-4 tv:p-5 tv-4k:p-6", TV_SIDEBAR_CARD)}
    >
      <div className="mb-2 flex items-center gap-2">
        <Bot className="h-4 w-4 text-cyan-400 tv:h-5 tv:w-5" />
        <p className={TV_TEXT_LABEL}>{t("producao.tv.locutor.titulo")}</p>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400 tv:text-xs">
        {t("producao.tv.locutor.descricao")}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (locutorIaAtivo) {
              setLocutorIaAtivo(false);
              return;
            }
            setLocutorIaAtivo(true);
            void falarAgora();
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

      {locutorIaAtivo && precisaToque ? (
        <p className="mt-2 text-[11px] font-medium text-amber-300 tv:text-xs">
          {t("producao.tv.locutor.toqueParaOuvir")}
        </p>
      ) : null}

      {!ttsDisponivel ? (
        <p className="mt-2 text-[11px] text-amber-300/90 tv:text-xs">
          {t("producao.tv.locutor.semTts")}
        </p>
      ) : null}

      <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {t("producao.tv.locutor.resumo")}
        </p>
        <p className="mt-1 font-tv-mono text-xs text-slate-200 tv:text-sm">
          {resumo.total} {t("producao.tv.locutor.paraEntregar")} · {resumo.noPrazo}{" "}
          {t("producao.tv.locutor.noPrazo")} · {resumo.atrasados.length}{" "}
          {t("producao.tv.locutor.atrasados")}
        </p>
        {resumo.atrasados.slice(0, 3).map((item) => (
          <p key={item.id} className="mt-1 truncate text-[11px] text-red-300/90 tv:text-xs">
            {item.paciente} — {item.horarioFala}
          </p>
        ))}
      </div>

      {ultimaFala ? (
        <p className="mt-2 line-clamp-4 text-[10px] leading-relaxed text-slate-500 tv:text-[11px]">
          {ultimaFala}
        </p>
      ) : null}
    </motion.div>
  );
}
