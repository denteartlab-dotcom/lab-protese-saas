"use client";

import { useI18n } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n";

export function BreadcrumbProducao({ pagina }: { pagina: MessageKey }) {
  const { t } = useI18n();
  return (
    <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
      <span>{t("producao.breadcrumb.producao")}</span>
      <span>/</span>
      <span className="font-medium text-slate-700">{t(pagina)}</span>
    </div>
  );
}
