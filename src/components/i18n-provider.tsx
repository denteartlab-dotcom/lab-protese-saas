"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ARMAZENAMENTO_LAB_PRONTO_EVENT } from "@/lib/armazenamento-laboratorio";
import { LAB_CONFIG_ATUALIZADA_EVENT } from "@/lib/configuracoes-lab";
import { lerIdiomaLocal } from "@/lib/idioma-ui";
import {
  carregarIdiomaSite,
  htmlLangAttr,
  translate,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";
import { trUi } from "@/lib/i18n/tr-ui";

type I18nContextValue = {
  locale: Locale;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  refreshLocale: () => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function localeInicialCliente(): Locale {
  if (typeof window === "undefined") return "pt";
  return lerIdiomaLocal() ?? carregarIdiomaSite();
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(localeInicialCliente);

  const refreshLocale = useCallback(() => {
    setLocale(carregarIdiomaSite());
  }, []);

  useEffect(() => {
    refreshLocale();
    const onAtualizar = () => refreshLocale();
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, onAtualizar);
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onAtualizar);
    return () => {
      window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, onAtualizar);
      window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onAtualizar);
    };
  }, [refreshLocale]);

  useEffect(() => {
    document.documentElement.lang = htmlLangAttr(locale);
  }, [locale]);

  useEffect(() => {
    const alertOriginal = window.alert.bind(window);
    window.alert = (mensagem?: unknown) => {
      const texto = mensagem == null ? "" : String(mensagem);
      alertOriginal(trUi(texto, (key, params) => translate(locale, key, params)));
    };
    return () => {
      window.alert = alertOriginal;
    };
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, params) => translate(locale, key, params),
      refreshLocale,
    }),
    [locale, refreshLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "pt" as Locale,
      t: (key: MessageKey, params?: Record<string, string | number>) =>
        translate("pt", key, params),
      refreshLocale: () => {},
    };
  }
  return ctx;
}
