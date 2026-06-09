"use client";

import { Tv } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function ModuloTvConteudo() {
  const { t } = useI18n();

  return (
    <div className="space-y-4 text-[13px] text-slate-700">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>{t("nav.producao")}</span>
        <span>/</span>
        <span className="font-medium text-slate-700">{t("nav.moduloTv")}</span>
      </div>

      <div className="flex items-center gap-2">
        <Tv className="h-6 w-6 text-[#4a90d9]" strokeWidth={1.75} />
        <h1 className="text-2xl font-normal text-slate-700">{t("nav.moduloTv")}</h1>
      </div>

      <div className="rounded border border-[#d4d4d4] bg-white px-6 py-10 text-center shadow-sm">
        <p className="text-[14px] text-slate-600">{t("relatorio.emBreve")}</p>
      </div>
    </div>
  );
}
