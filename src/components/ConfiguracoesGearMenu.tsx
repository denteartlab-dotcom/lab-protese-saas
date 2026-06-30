"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
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

export function ConfiguracoesGearMenu() {
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

  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  useEffect(() => {
    if (!aberto) return;
    function fecharFora(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", fecharFora);
    return () => document.removeEventListener("mousedown", fecharFora);
  }, [aberto]);

  if (!temPermissaoAlgumaConfiguracao(acessoTotal, permissoesModulos)) {
    return null;
  }

  return (
    <div className="relative" ref={ref}>
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

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[min(70vh,420px)] w-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          {itensVisiveis.map((item) => {
            const itemAba = item.href.includes("aba=")
              ? item.href.split("aba=")[1]?.split("&")[0] || "dados"
              : "";
            const ativo =
              item.href === "/app/configuracoes/cabecalho"
                ? pathname.startsWith("/app/configuracoes/cabecalho")
                : pathname.startsWith("/app/configuracoes") && abaAtual === itemAba;
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
      )}
    </div>
  );
}
