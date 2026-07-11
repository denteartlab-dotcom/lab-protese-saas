"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n";

type Props = {
  labelKey: MessageKey;
  /** Conteúdo à direita (ex.: toggle diário/mensal). */
  acoes?: ReactNode;
  className?: string;
};

/** Breadcrumb padrão dos relatórios: Início / Relatórios / título. */
export function RelatorioCabecalho({ labelKey, acoes, className = "" }: Props) {
  const { t } = useI18n();
  const titulo = t(labelKey);

  return (
    <div className={`mb-3 flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
        <Home className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <Link href="/app" className="hover:text-[#4a90d9]">
          {t("nav.inicio")}
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-700">{t("nav.relatorios")}</span>
        <span>/</span>
        <span className="font-medium text-slate-700">{titulo}</span>
      </div>
      {acoes}
    </div>
  );
}

/** Título lateral usado em layouts com menu de relatórios à esquerda. */
export function RelatorioTituloLateral({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <h1
      className={`text-[22px] font-normal leading-none text-[#6b7280] dark:text-slate-400 ${className}`}
    >
      {t("relatorio.tituloSecao")}
    </h1>
  );
}
