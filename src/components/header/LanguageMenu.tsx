"use client";

import { useEffect, useRef, useState } from "react";
import {
  carregarConfigLaboratorio,
  prepararConfigParaSalvar,
  salvarConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { useI18n } from "@/components/i18n-provider";
import { FlagIcon } from "@/components/header/FlagIcon";
import type { Locale } from "@/lib/i18n";
import { persistirIdiomaLocal } from "@/lib/idioma-ui";
import { persistirConfigLaboratorioServidor } from "@/lib/lab-config-sync";
import { cn } from "@/lib/utils";

const opcoes: { locale: Locale; labelKey: "lang.pt" | "lang.en" | "lang.es" }[] = [
  { locale: "pt", labelKey: "lang.pt" },
  { locale: "en", labelKey: "lang.en" },
  { locale: "es", labelKey: "lang.es" },
];

export function LanguageMenu() {
  const { locale, t, refreshLocale } = useI18n();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  function escolher(novo: Locale) {
    persistirIdiomaLocal(novo);
    const cfg = carregarConfigLaboratorio();
    const patch =
      novo === "en"
        ? { idioma: novo, pais: "Estados Unidos", moeda: "Dólar", codigoPaisTelefone: "+1" }
        : novo === "es"
          ? { idioma: novo, pais: "España", moeda: "Euro", codigoPaisTelefone: "+34" }
          : { idioma: novo, pais: "Brasil", moeda: "Real", codigoPaisTelefone: "+55" };
    const atualizado = prepararConfigParaSalvar({ ...cfg, ...patch });
    salvarConfigLaboratorio(atualizado);
    void persistirConfigLaboratorioServidor(atualizado).catch(() => undefined);
    refreshLocale();
    setAberto(false);
  }

  const atual = opcoes.find((o) => o.locale === locale) || opcoes[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-md border border-transparent px-2 text-xs text-slate-600 transition hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800",
          aberto && "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
        )}
        aria-expanded={aberto}
        aria-label={t("header.idioma")}
        title={t("header.idioma")}
      >
        <FlagIcon locale={atual.locale} className="h-[13px] w-[18px]" />
        <span className="hidden max-w-[80px] truncate sm:inline">{t(atual.labelKey)}</span>
      </button>
      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[158px] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {opcoes.map((op) => (
            <button
              key={op.locale}
              type="button"
              onClick={() => escolher(op.locale)}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800",
                locale === op.locale && "bg-[#eef5fc] font-medium text-[#4a90d9]"
              )}
            >
              <FlagIcon locale={op.locale} className="h-[13px] w-[18px]" />
              {t(op.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
