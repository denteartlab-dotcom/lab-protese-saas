"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Menu, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { usePermissoesApp } from "@/components/PermissoesAppProvider";
import {
  appNavPrincipal,
  appNavSemDropdown,
  gruposNavMobile,
  type AppNavItem,
} from "@/lib/app-nav";
import {
  navGrupoTemAcesso,
  podeVerHref,
} from "@/lib/permissoes-acesso";
import { cn } from "@/lib/utils";
import { ehPaginaInicioApp, menuAppSecaoAtiva } from "@/lib/rotas-app";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  nomeLaboratorio: string;
  logoDataUrl?: string;
  logoLargura?: number;
  logoAltura?: number;
};

function linkAtivo(pathname: string, href: string) {
  const base = href.split("?")[0];
  if (base === "/app") return ehPaginaInicioApp(pathname);
  const sufixo = base.replace(/^\/app/, "") || "/";
  return menuAppSecaoAtiva(pathname, sufixo);
}

function ItemNavSimples({
  item,
  pathname,
  onNavigate,
  oculto,
}: {
  item: AppNavItem;
  pathname: string;
  onNavigate: () => void;
  oculto?: boolean;
}) {
  const { t } = useI18n();
  if (oculto) return null;
  const ativo = linkAtivo(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        ativo
          ? "bg-primary-600 text-white shadow-sm shadow-primary-600/20"
          : "text-slate-700 hover:bg-slate-100"
      )}
    >
      <item.icon className="h-5 w-5 shrink-0 opacity-90" />
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}

function GrupoNavExpansivel({
  grupo,
  pathname,
  expandido,
  onToggle,
  onNavigate,
  itensVisiveis,
}: {
  grupo: (typeof gruposNavMobile)[number];
  pathname: string;
  expandido: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  itensVisiveis: AppNavItem[];
}) {
  const { t } = useI18n();
  if (itensVisiveis.length === 0) return null;
  const ativo = grupo.ativo(pathname);

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
          ativo
            ? "bg-primary-600 text-white shadow-sm shadow-primary-600/20"
            : "text-slate-700 hover:bg-slate-100"
        )}
      >
        <grupo.icon className="h-5 w-5 shrink-0 opacity-90" />
        <span className="flex-1">{t(grupo.labelKey)}</span>
        {expandido ? (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-80" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 opacity-80" />
        )}
      </button>
      {expandido ? (
        <div className="ml-2 space-y-0.5 border-l border-slate-200 pl-2">
          {itensVisiveis.map((item) => {
            const itemAtivo = linkAtivo(pathname, item.href);
            return (
              <Link
                key={`${grupo.id}-${item.href}-${item.labelKey}`}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  itemAtivo
                    ? "bg-primary-50 font-medium text-primary-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-primary-700"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function BotaoMenuMobile({
  aberto,
  onAlternar,
}: {
  aberto: boolean;
  onAlternar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAlternar}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-label={aberto ? "Fechar menu" : "Abrir menu"}
      aria-expanded={aberto}
    >
      {aberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );
}

export function AppMobileNav({
  aberto,
  onFechar,
  nomeLaboratorio,
  logoDataUrl,
  logoLargura = 36,
  logoAltura = 36,
}: Props) {
  const { t } = useI18n();
  const { acessoTotal, permissoesModulos } = usePermissoesApp();
  const pathname = usePathname();
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null);

  function podeVer(href: string) {
    return podeVerHref(acessoTotal, permissoesModulos, href);
  }

  useEffect(() => {
    onFechar();
  }, [pathname, onFechar]);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [aberto, onFechar]);

  useEffect(() => {
    if (!aberto) {
      setGrupoExpandido(null);
      return;
    }
    const abertoPorRota = gruposNavMobile.find((g) => g.ativo(pathname));
    if (abertoPorRota) setGrupoExpandido(abertoPorRota.id);
  }, [aberto, pathname]);

  if (!aberto) return null;

  const temLogo = Boolean(logoDataUrl?.startsWith("data:image"));

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        aria-label="Fechar menu"
        onClick={onFechar}
      />
      <aside
        className="no-print fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,280px)] flex-col bg-white shadow-2xl lg:hidden dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2.5">
            {temLogo ? (
              <img
                src={logoDataUrl}
                alt=""
                className="h-9 w-9 shrink-0 object-contain"
                width={logoLargura}
                height={logoAltura}
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                {nomeLaboratorio.charAt(0).toUpperCase()}
              </span>
            )}
            <p
              suppressHydrationWarning
              className="truncate text-sm font-bold text-slate-800 dark:text-slate-100"
            >
              {nomeLaboratorio}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          <ItemNavSimples
            item={appNavPrincipal[0]}
            pathname={pathname}
            onNavigate={onFechar}
            oculto={!podeVer("/app")}
          />

          {gruposNavMobile.map((grupo) => {
            const itensVisiveis = grupo.itens.filter((item) => podeVer(item.href));
            if (!navGrupoTemAcesso(acessoTotal, permissoesModulos, grupo.itens)) return null;
            return (
            <GrupoNavExpansivel
              key={grupo.id}
              grupo={grupo}
              pathname={pathname}
              expandido={grupoExpandido === grupo.id}
              onToggle={() =>
                setGrupoExpandido((atual) => (atual === grupo.id ? null : grupo.id))
              }
              onNavigate={onFechar}
              itensVisiveis={itensVisiveis}
            />
            );
          })}

          {appNavPrincipal
            .filter((item) => !appNavSemDropdown.has(item.labelKey))
            .map((item) => (
              <ItemNavSimples
                key={`${item.href}-${item.labelKey}`}
                item={item}
                pathname={pathname}
                onNavigate={onFechar}
                oculto={!podeVer(item.href)}
              />
            ))}
        </nav>
      </aside>
    </>
  );
}
