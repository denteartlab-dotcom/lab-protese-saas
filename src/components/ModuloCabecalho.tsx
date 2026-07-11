"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n";

type Props = {
  /** Chave do módulo pai (nav.cadastros, nav.estoque). */
  moduloKey: MessageKey;
  /** Chave do item atual (nav.clientes, nav.produtos, etc.). */
  tituloKey: MessageKey;
  hrefModulo?: string;
  acoes?: ReactNode;
  className?: string;
};

/** Breadcrumb padrão: Início / Módulo / Página atual. */
export function ModuloCabecalho({
  moduloKey,
  tituloKey,
  hrefModulo,
  acoes,
  className = "",
}: Props) {
  const { t } = useI18n();

  return (
    <div className={`mb-3 flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
        <Home className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <Link href="/app" className="hover:text-primary-700">
          {t("nav.inicio")}
        </Link>
        <span>/</span>
        {hrefModulo ? (
          <Link href={hrefModulo} className="font-medium text-slate-700 hover:text-primary-700">
            {t(moduloKey)}
          </Link>
        ) : (
          <span className="font-medium text-slate-700">{t(moduloKey)}</span>
        )}
        <span>/</span>
        <span className="font-medium text-slate-800">{t(tituloKey)}</span>
      </div>
      {acoes}
    </div>
  );
}
