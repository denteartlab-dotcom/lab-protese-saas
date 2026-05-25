"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LAB_CONFIG_ATUALIZADA_EVENT } from "@/lib/configuracoes-lab";
import {
  carregarIdiomaSite,
  htmlLangAttr,
  translate,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  refreshLocale: () => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("pt");

  const refreshLocale = useCallback(() => {
    setLocale(carregarIdiomaSite());
  }, []);

  useEffect(() => {
    refreshLocale();
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, refreshLocale);
    return () => window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, refreshLocale);
  }, [refreshLocale]);

  useEffect(() => {
    document.documentElement.lang = htmlLangAttr(locale);
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
