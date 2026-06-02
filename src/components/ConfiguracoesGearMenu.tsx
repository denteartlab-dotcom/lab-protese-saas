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
  Users,
  Wrench,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const itensConfiguracao = [
  { href: "/app/configuracoes?aba=dados", labelKey: "settings.dadosLabTitulo" as MessageKey, icon: FileText },
  { href: "/app/configuracoes/cabecalho", labelKey: "settings.cabecalho" as MessageKey, icon: FileText },
  { href: "/app/configuracoes?aba=gerais", labelKey: "settings.gerais" as MessageKey, icon: Wrench },
  { href: "/app/configuracoes?aba=boletos", labelKey: "settings.boletos" as MessageKey, icon: BarChart3 },
  { href: "/app/configuracoes?aba=mensagens", labelKey: "settings.mensagens" as MessageKey, icon: MessageCircle },
  { href: "/app/configuracoes?aba=os", labelKey: "settings.os" as MessageKey, icon: ClipboardList },
  { href: "/app/configuracoes?aba=faturas", labelKey: "settings.faturas" as MessageKey, icon: FileText },
  { href: "/app/configuracoes?aba=usuarios", labelKey: "settings.usuarios" as MessageKey, icon: Users },
  { href: "/app/configuracoes?aba=backup", labelKey: "settings.backup" as MessageKey, icon: DatabaseBackup },
];

export function ConfiguracoesGearMenu() {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const abaAtual = searchParams.get("aba") || "dados";
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          {itensConfiguracao.map((item) => {
            const itemAba = item.href.split("aba=")[1] || "dados";
            const ativo =
              item.href === "/app/configuracoes/cabecalho"
                ? pathname.startsWith("/app/configuracoes/cabecalho")
                : pathname.startsWith("/app/configuracoes") && abaAtual === itemAba;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAberto(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-xs transition",
                  ativo
                    ? "bg-primary-50 font-medium text-primary-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-primary-700 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
