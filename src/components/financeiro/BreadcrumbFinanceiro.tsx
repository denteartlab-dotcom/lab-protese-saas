"use client";

import { useI18n } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n";

export function BreadcrumbFinanceiro({ pagina }: { pagina: MessageKey }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
      <span>{t("financeiro.breadcrumb.financeiro")}</span>
      <span className="text-slate-400 dark:text-slate-500">&gt;</span>
      <span className="font-medium text-slate-700 dark:text-slate-300">{t(pagina)}</span>
    </div>
  );
}
