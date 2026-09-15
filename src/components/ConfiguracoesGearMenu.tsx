"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  Cog,
  DatabaseBackup,
  FileText,
  MessageCircle,
  Tag,
  Users,
  Wrench,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { usePermissoesApp } from "@/components/PermissoesAppProvider";
import type { MessageKey } from "@/lib/i18n";
import {
  ITENS_MENU_CONFIGURACOES,
  podeVerModulo,
  temPermissaoAlgumaConfiguracao,
} from "@/lib/permissoes-acesso";
import { cn } from "@/lib/utils";

const iconesConfig: Record<string, typeof FileText> = {
  "settings.dadosLabTitulo": FileText,
  "settings.cabecalho": FileText,
  "settings.gerais": Wrench,
  "settings.boletos": BarChart3,
  "settings.mensagens": MessageCircle,
  "settings.os": ClipboardList,
  "settings.faturas": FileText,
  "settings.etiquetas": Tag,
  "settings.usuarios": Users,
  "settings.backup": DatabaseBackup,
};

type Variant = "header" | "sidebar" | "mobile";

type Props = {
  variant?: Variant;
  className?: string;
};

function itemConfigAtivo(
  href: string,
  pathname: string,
  abaAtual: string
) {
  if (href === "/app/configuracoes/cabecalho") {
    return pathname.startsWith("/app/configuracoes/cabecalho");
  }
  const itemAba = href.includes("aba=")
    ? href.split("aba=")[1]?.split("&")[0] || "dados"
    : "";
  return pathname.startsWith("/app/configuracoes") && abaAtual === itemAba;
}

export function ConfiguracoesGearMenu({
  variant = "header",
  className,
}: Props) {
  const { t } = useI18n();
  const { acessoTotal, permissoesModulos } = usePermissoesApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const abaAtual = searchParams.get("aba") || "dados";
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const itensVisiveis = ITENS_MENU_CONFIGURACOES.filter((item) =>
    podeVerModulo(acessoTotal, permissoesModulos, item.permissaoId)
  );
  const algumAtivo = itensVisiveis.some((item) =>
    itemConfigAtivo(item.href, pathname, abaAtual)
  );

  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  useEffect(() => {
    if (!aberto || variant === "sidebar" || variant === "mobile") return;
    function fecharFora(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", fecharFora);
    return () => document.removeEventListener("mousedown", fecharFora);
  }, [aberto, variant]);

  if (!temPermissaoAlgumaConfiguracao(acessoTotal, permissoesModulos)) {
    return null;
  }

  if (variant === "sidebar") {
    return (
      <div className={cn("mt-8", className)} ref={ref}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setAberto((atual) => !atual)}
          aria-expanded={aberto}
          className={cn(
            "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] leading-snug tracking-tight caret-transparent outline-none transition focus:outline-none focus-visible:ring-0",
            algumAtivo || aberto
              ? "bg-gradient-to-r from-teal-500 to-cyan-500 font-semibold text-white shadow-nav"
              : "font-medium text-white/75 hover:bg-white/10 hover:text-white"
          )}
        >
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[17px] leading-none"
            aria-hidden
          >
            ⚙️
          </span>
          <span className="min-w-0 flex-1 truncate text-left">
            {t("settings.titulo")}
          </span>
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 shrink-0 opacity-60 transition-transform",
              aberto && "rotate-180"
            )}
          />
        </button>
        {aberto ? (
          <div className="mt-1 space-y-0.5 rounded-xl border border-white/10 bg-black/20 p-1.5">
            {itensVisiveis.map((item) => {
              const ativo = itemConfigAtivo(item.href, pathname, abaAtual);
              return (
                <Link
                  key={item.permissaoId}
                  href={item.href}
                  onClick={() => setAberto(false)}
                  className={cn(
                    "flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-[13px] caret-transparent outline-none transition focus:outline-none",
                    ativo
                      ? "bg-white/15 font-semibold text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {t(item.labelKey as MessageKey)}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (variant === "mobile") {
    return (
      <div className={cn("mt-6 space-y-1", className)} ref={ref}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setAberto((atual) => !atual)}
          aria-expanded={aberto}
          className={cn(
            "flex w-full cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium caret-transparent outline-none transition-colors focus:outline-none",
            algumAtivo || aberto
              ? "bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-100"
              : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          )}
        >
          <span className="text-[17px] leading-none" aria-hidden>
            ⚙️
          </span>
          <span className="min-w-0 flex-1 truncate">{t("settings.titulo")}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 opacity-60 transition-transform",
              aberto && "rotate-180"
            )}
          />
        </button>
        {aberto ? (
          <div className="space-y-0.5 rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/50">
            {itensVisiveis.map((item) => {
              const ativo = itemConfigAtivo(item.href, pathname, abaAtual);
              const Icon = iconesConfig[item.labelKey] || FileText;
              return (
                <Link
                  key={item.permissaoId}
                  href={item.href}
                  onClick={() => setAberto(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition",
                    ativo
                      ? "bg-teal-100 font-semibold text-teal-800 dark:bg-teal-900/40 dark:text-teal-100"
                      : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {t(item.labelKey as MessageKey)}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition",
          aberto
            ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        )}
        title={t("settings.abrir")}
        aria-expanded={aberto}
        aria-label={t("settings.abrir")}
      >
        <Cog className="h-5 w-5" />
      </button>

      {aberto ? (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[min(70vh,420px)] w-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          {itensVisiveis.map((item) => {
            const ativo = itemConfigAtivo(item.href, pathname, abaAtual);
            const Icon = iconesConfig[item.labelKey] || FileText;
            return (
              <Link
                key={item.permissaoId}
                href={item.href}
                onClick={() => setAberto(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-xs transition",
                  ativo
                    ? "bg-primary-50 font-medium text-primary-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-primary-700 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {t(item.labelKey as MessageKey)}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
