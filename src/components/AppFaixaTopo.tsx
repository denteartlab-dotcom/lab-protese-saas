"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/components/i18n-provider";
import { FAIXA_TOPO_ALTURA, LogoMarcaDenteArt } from "@/components/LogoMarcaDenteArt";

type Props = {
  esquerda: ReactNode;
  direita: ReactNode;
  logoHref?: string;
  antes?: ReactNode;
};

/**
 * Barra cinza estreita full-width (referência Smart Prótese):
 * ícones à esquerda, logo centralizada, ações à direita.
 */
export function AppFaixaTopo({
  esquerda,
  direita,
  logoHref = "/app",
  antes,
}: Props) {
  const { t } = useI18n();
  return (
    <header className="site-topo-marca relative shrink-0" role="banner">
      {antes}
      <div
        className="relative flex w-full items-center justify-between gap-2 px-2 sm:px-4"
        style={{ height: FAIXA_TOPO_ALTURA }}
      >
        <div className="z-10 flex min-w-0 flex-1 items-center justify-start gap-2 sm:gap-3">
          {esquerda}
        </div>

        <Link
          href={logoHref}
          className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-500/30"
          title={t("shell.topo.irInicio")}
        >
          <LogoMarcaDenteArt variant="topo" />
        </Link>

        <div className="z-10 flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
          {direita}
        </div>
      </div>
    </header>
  );
}
