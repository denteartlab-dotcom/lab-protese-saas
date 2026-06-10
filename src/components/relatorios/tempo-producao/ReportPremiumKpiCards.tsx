"use client";

import {
  AlertTriangle,
  CalendarCheck,
  Clock,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import type { ResumoTempoProducao } from "@/lib/tempo-producao-relatorio";
import { formatarDiasPremium } from "@/lib/tempo-producao-premium";

type Props = { resumo: ResumoTempoProducao };

const cards = [
  {
    key: "total",
    titulo: "Total OS no período",
    icon: CalendarCheck,
    iconBg: "bg-blue-50 text-blue-600",
    valor: (r: ResumoTempoProducao) => String(r.totalEmProducao),
    sub: (r: ResumoTempoProducao) => "100% das OS",
  },
  {
    key: "atrasadas",
    titulo: "Atrasadas",
    icon: AlertTriangle,
    iconBg: "bg-red-50 text-red-600",
    valor: (r: ResumoTempoProducao) => String(r.totalAtrasadas),
    sub: (r: ResumoTempoProducao) => `${r.percentualAtrasadas}% do total`,
    destaque: "text-red-600",
  },
  {
    key: "media",
    titulo: "Tempo médio geral",
    icon: Timer,
    iconBg: "bg-blue-50 text-blue-600",
    valor: (r: ResumoTempoProducao) => `${formatarDiasPremium(r.tempoMedioGeral)} dias`,
    sub: (r: ResumoTempoProducao) => `Meta: ${r.metaTempoDias} dias`,
  },
  {
    key: "maior",
    titulo: "Maior atraso",
    icon: TrendingUp,
    iconBg: "bg-red-50 text-red-600",
    valor: (r: ResumoTempoProducao) => `${r.maiorAtrasoDias} dias`,
    sub: (r: ResumoTempoProducao) =>
      r.maiorAtrasoOs ? `OS #${r.maiorAtrasoOs}` : "—",
    destaque: "text-red-600",
  },
  {
    key: "colab",
    titulo: "Entrega média colaborador",
    icon: Users,
    iconBg: "bg-emerald-50 text-emerald-600",
    valor: (r: ResumoTempoProducao) => `${formatarDiasPremium(r.entregaMediaColaborador)} dias`,
    sub: () => "No período",
  },
  {
    key: "entregues",
    titulo: "OS entregues",
    icon: Clock,
    iconBg: "bg-emerald-50 text-emerald-600",
    valor: (r: ResumoTempoProducao) => String(r.osEntregues),
    sub: (r: ResumoTempoProducao) => `${r.percentualEntregues}% do total`,
    destaque: "text-emerald-600",
  },
] as const;

export function ReportPremiumKpiCards({ resumo }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 tv:gap-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="rounded-2xl border border-[#e8ecf2] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.06)] transition hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.iconBg}`}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">{card.titulo}</p>
            <p
              className={`mt-1 text-3xl font-bold tracking-tight text-slate-900 tv:text-4xl ${"destaque" in card ? card.destaque : ""}`}
            >
              {card.valor(resumo)}
            </p>
            <p className="mt-1 text-xs text-slate-400">{card.sub(resumo)}</p>
          </div>
        );
      })}
    </div>
  );
}
