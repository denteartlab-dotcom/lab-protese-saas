"use client";

import {
  AlertTriangle,
  Clock,
  Layers,
  Timer,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { InfoTooltip } from "@/components/relatorios/tempo-producao/InfoTooltip";
import { tooltipTempo } from "@/components/relatorios/tempo-producao/tempo-i18n";
import type { ResumoTempoProducao } from "@/lib/tempo-producao-relatorio";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  resumo: ResumoTempoProducao;
};

const cards: {
  key: "total" | "atrasadas" | "criticas" | "mediaLab" | "mediaEtapa" | "colabAtraso" | "gargalo";
  labelKey: MessageKey;
  icon: typeof Workflow;
  cor: string;
  tooltipKey?: keyof typeof import("@/components/relatorios/tempo-producao/tempo-i18n").TOOLTIP_TEMPO_KEYS;
  destaque?: boolean;
}[] = [
  { key: "total", labelKey: "relatorio.tempo.kpi.osEmProducao", icon: Workflow, cor: "from-slate-600 to-slate-800" },
  {
    key: "atrasadas",
    labelKey: "relatorio.tempo.kpi.osAtrasadas",
    icon: AlertTriangle,
    cor: "from-orange-500 to-orange-700",
    tooltipKey: "diasAtraso",
  },
  {
    key: "criticas",
    labelKey: "relatorio.tempo.kpi.osCriticas",
    icon: AlertTriangle,
    cor: "from-red-500 to-red-700",
    tooltipKey: "status",
    destaque: true,
  },
  {
    key: "mediaLab",
    labelKey: "relatorio.tempo.kpi.mediaDiasLab",
    icon: Clock,
    cor: "from-blue-500 to-blue-700",
    tooltipKey: "diasLaboratorio",
  },
  {
    key: "mediaEtapa",
    labelKey: "relatorio.tempo.kpi.mediaDiasEtapa",
    icon: Timer,
    cor: "from-violet-500 to-violet-700",
    tooltipKey: "diasEtapa",
  },
  {
    key: "colabAtraso",
    labelKey: "relatorio.tempo.kpi.colabMaiorAtraso",
    icon: Users,
    cor: "from-amber-500 to-amber-700",
    tooltipKey: "responsavelAtraso",
  },
  {
    key: "gargalo",
    labelKey: "relatorio.tempo.kpi.etapaGargalo",
    icon: Layers,
    cor: "from-emerald-500 to-emerald-700",
    tooltipKey: "gargalo",
  },
];

export function ReportSummaryCards({ resumo }: Props) {
  const { t } = useI18n();

  function valor(key: (typeof cards)[number]["key"]) {
    switch (key) {
      case "total":
        return String(resumo.totalEmProducao);
      case "atrasadas":
        return String(resumo.totalAtrasadas);
      case "criticas":
        return String(resumo.totalCriticas);
      case "mediaLab":
        return `${resumo.mediaDiasLaboratorio}d`;
      case "mediaEtapa":
        return `${resumo.mediaDiasEtapa}d`;
      case "colabAtraso":
        return resumo.colaboradorMaiorAtraso
          ? `${resumo.colaboradorMaiorAtraso.nome} (${resumo.colaboradorMaiorAtraso.dias}d)`
          : "—";
      case "gargalo":
        return resumo.etapaMaiorGargalo
          ? `${resumo.etapaMaiorGargalo.nome} (${resumo.etapaMaiorGargalo.dias}d)`
          : "—";
      default:
        return "—";
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((card) => {
        const Icon = card.icon;
        const critico = card.key === "criticas" && resumo.totalCriticas > 0;
        const tooltip = card.tooltipKey ? tooltipTempo(card.tooltipKey, t) : "";
        return (
          <div
            key={card.key}
            className={cn(
              "overflow-hidden rounded-xl border shadow-sm transition",
              critico
                ? "border-red-300 bg-white ring-2 ring-red-200 dark:border-red-800 dark:bg-slate-800 dark:ring-red-900/50"
                : "border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-800/90"
            )}
          >
            <div className={cn("bg-gradient-to-br px-3 py-2", card.cor)}>
              <div className="flex items-center gap-2 text-white/90">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-[11px] font-medium leading-tight">{t(card.labelKey)}</span>
                {tooltip ? <InfoTooltip texto={tooltip} className="[&_svg]:text-white/70" /> : null}
              </div>
            </div>
            <div className="px-3 py-3">
              <p
                className={cn(
                  "text-lg font-bold",
                  critico ? "text-red-700 dark:text-red-400" : "text-slate-800 dark:text-slate-100"
                )}
              >
                {valor(card.key)}
              </p>
            </div>
          </div>
        );
      })}
      <div className="hidden items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2 text-center text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800/30 dark:text-slate-400 xl:flex">
        <TrendingUp className="mr-1.5 h-4 w-4" />
        {t("relatorio.tempo.indicadoresTempoReal")}
      </div>
    </div>
  );
}
