"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, LockKeyhole, LogOut, Menu, X } from "lucide-react";
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
import { limparUltimaAtividadeSessao } from "@/lib/sessao-inatividade";
import { cn } from "@/lib/utils";
import { ehPaginaInicioApp, menuAppSecaoAtiva } from "@/lib/rotas-app";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  nomeLaboratorio: string;
  papelUsuario?: string;
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


function IconeNavMobile({
  emoji,
  Icon,
  className = "h-5 w-5 shrink-0 opacity-90",
}: {
  emoji?: string;
  Icon: AppNavItem["icon"];
  className?: string;
}) {
  if (emoji) {
    return (
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[16px] leading-none"
        aria-hidden
      >
        {emoji}
      </span>
    );
  }
  return <Icon className={className} />;
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
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors",
        ativo
          ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-nav"
          : "text-slate-700 hover:bg-teal-50 dark:text-slate-300 dark:hover:bg-slate-800"
      )}
    >
      <IconeNavMobile emoji={item.emoji} Icon={item.icon} />
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
            ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-nav"
            : "text-slate-700 hover:bg-teal-50"
        )}
      >
        <IconeNavMobile emoji={grupo.emoji} Icon={grupo.icon} />
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
                  "flex items-center rounded-lg px-3 py-2 text-sm transition-colors",
                  itemAtivo
                    ? "bg-primary-50 font-medium text-primary-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-primary-700"
                )}
              >
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
  papelUsuario,
  logoDataUrl,
  logoLargura = 36,
  logoAltura = 36,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const { acessoTotal, permissoesModulos } = usePermissoesApp();
  const pathname = usePathname();
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null);
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false);

  function podeVer(href: string) {
    return podeVerHref(acessoTotal, permissoesModulos, href);
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      limparUltimaAtividadeSessao();
      window.location.href = "/login";
    }
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
      setMenuUsuarioAberto(false);
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
        className="no-print fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,280px)] flex-col bg-white/95 shadow-panel backdrop-blur-md lg:hidden dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
      >
        <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setGrupoExpandido(null);
                setMenuUsuarioAberto((atual) => !atual);
              }}
              aria-expanded={menuUsuarioAberto}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {temLogo ? (
                <img
                  src={logoDataUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain ring-1 ring-slate-200 shadow-sm"
                  width={Math.max(logoLargura, 112)}
                  height={Math.max(logoAltura, 112)}
                  decoding="async"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-base font-bold text-primary-700">
                  {nomeLaboratorio.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p
                  suppressHydrationWarning
                  className="truncate text-sm font-bold text-slate-800 dark:text-slate-100"
                >
                  {nomeLaboratorio}
                </p>
                {papelUsuario ? (
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {papelUsuario}
                  </p>
                ) : null}
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                  menuUsuarioAberto && "rotate-180"
                )}
              />
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {menuUsuarioAberto ? (
            <div className="mt-2 space-y-0.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/60">
              <button
                type="button"
                onClick={() => {
                  onFechar();
                  router.push("/app/alterar-senha");
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <LockKeyhole className="h-4 w-4 shrink-0 opacity-90" />
                <span>{t("user.alterarSenha")}</span>
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-200 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>{t("user.logout")}</span>
              </button>
            </div>
          ) : null}
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
              onToggle={() => {
                setMenuUsuarioAberto(false);
                setGrupoExpandido((atual) => (atual === grupo.id ? null : grupo.id));
              }}
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
