"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { filtrarPaginasSite } from "@/lib/site-pages";
import { cn } from "@/lib/utils";

type Props = {
  aberto: boolean;
  onFechar: () => void;
};

export function SiteSearchBar({ aberto, onFechar }: Props) {
  const { t } = useI18n();
  const [termo, setTermo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setTermo("");
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const resultados = filtrarPaginasSite(termo, t);

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="relative mx-auto flex max-w-4xl items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder={t("header.buscar")}
          className="h-9 w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          aria-label={t("header.buscarTitulo")}
        />
        <button
          type="button"
          onClick={onFechar}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={t("header.fecharBusca")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {termo.trim().length > 0 && (
        <div className="mx-auto mt-2 max-h-64 max-w-4xl overflow-y-auto rounded-md border border-slate-100 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {resultados.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-500">{t("header.semResultados")}</p>
          ) : (
            <ul>
              {resultados.map((page) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    onClick={onFechar}
                    className="flex flex-col gap-0.5 border-b border-slate-50 px-4 py-2.5 text-left transition hover:bg-slate-50 last:border-0 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t(page.labelKey)}
                    </span>
                    {page.sectionKey ? (
                      <span className="text-[10px] text-slate-400">{t(page.sectionKey)}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function SiteSearchButton({ onAbrir }: { onAbrir: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
      title={t("header.buscarTitulo")}
      aria-label={t("header.buscarTitulo")}
    >
      <Search className="h-5 w-5" />
    </button>
  );
}
