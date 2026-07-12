"use client";

import { useI18n } from "@/components/i18n-provider";

export function LoginLoadingFallback() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[50vh] flex-1 items-center justify-center bg-[#0a2f6e] text-sm text-white">
      {t("cadastros.comum.carregandoPagina")}
    </div>
  );
}
