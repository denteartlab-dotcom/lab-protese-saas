"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { ResumoFinanceiroDashboard } from "@/lib/dashboard-financeiro";
import { nomesMesesLocale } from "@/lib/i18n/meses-locale";
import type { Locale } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";

type Props = {
  titulo: string;
  resumo: ResumoFinanceiroDashboard;
  mes: number;
  ano: number;
  onMesChange: (mes: number) => void;
  onAnoChange: (ano: number) => void;
  locale: Locale;
};

export function PainelFinanceiroDashboard({
  titulo,
  resumo,
  mes,
  ano,
  onMesChange,
  onAnoChange,
  locale,
}: Props) {
  const { t } = useI18n();
  const meses = nomesMesesLocale(locale);
  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-10 items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-medium text-slate-700">{titulo}</h2>
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => onMesChange(Number(e.target.value))}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600"
          >
            {meses.map((nome, index) => (
              <option key={nome} value={index}>
                {nome}
              </option>
            ))}
          </select>
          <select
            value={ano}
            onChange={(e) => onAnoChange(Number(e.target.value))}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600"
          >
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <FinanceRow
          icon={TrendingUp}
          title={t("dashboard.finReceitas")}
          subtitle={t("dashboard.finAReceber")}
          value={formatCurrency(resumo.receitasAReceber)}
          tone="blue"
          href="/app/financeiro?acao=receber"
        />
        <FinanceRow
          icon={DollarSign}
          title={t("dashboard.finReceitas")}
          subtitle={t("dashboard.finInadimplencia")}
          value={formatCurrency(resumo.receitasInadimplencia)}
          tone="rose"
          href="/app/financeiro?acao=receber&situacao=atraso"
        />
        <FinanceRow
          icon={CheckCircle2}
          title={t("dashboard.finDespesas")}
          subtitle={t("dashboard.finAPagar")}
          value={formatCurrency(resumo.despesasAPagar)}
          tone="cyan"
          href="/app/financeiro?tipo=despesa"
        />
        <FinanceRow
          icon={TrendingDown}
          title={t("dashboard.finDespesas")}
          subtitle={t("dashboard.finContasVencidas")}
          value={formatCurrency(resumo.despesasVencidas)}
          tone="amber"
          href="/app/financeiro?tipo=despesa&tipoDespesa=atraso"
        />
      </div>
    </section>
  );
}

function FinanceRow({
  icon: Icon,
  title,
  subtitle,
  value,
  tone,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  value: string;
  tone: "blue" | "rose" | "cyan" | "amber";
  href: string;
}) {
  const tones = {
    blue: "bg-sky-50 text-sky-600",
    rose: "bg-rose-50 text-rose-500",
    cyan: "bg-cyan-50 text-cyan-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-sm transition hover:bg-slate-50/80"
    >
      <div className="flex items-center gap-3">
        <div className={`rounded p-2 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-700">{title}</p>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-700">{value}</span>
    </Link>
  );
}
