"use client";

import type { ReactNode } from "react";
import { useCallback } from "react";
import { useI18n } from "@/components/i18n-provider";
import { trUi, trUiFilho, trUiOpcoes, type TradutorUi } from "@/lib/i18n/tr-ui";
import { trUiArvore } from "@/lib/i18n/tr-ui-arvore";
import type { MessageKey } from "@/lib/i18n";

export function useTrUi() {
  const { t, locale } = useI18n();
  const tr = useCallback(
    (texto: string | undefined | null) => trUi(texto, t as TradutorUi, locale),
    [t, locale]
  );
  const trFilho = useCallback(
    (filho: React.ReactNode) => trUiFilho(filho, t as TradutorUi, locale),
    [t, locale]
  );
  const trOpcoes = useCallback(
    (opcoes: { value: string; label: string }[]) =>
      trUiOpcoes(opcoes, t as TradutorUi, locale),
    [t, locale]
  );
  const trArvore = useCallback(
    (filho: ReactNode) => trUiArvore(filho, t as TradutorUi, locale),
    [t, locale]
  );
  return {
    tr,
    trFilho,
    trOpcoes,
    trArvore,
    t: t as (key: MessageKey, params?: Record<string, string | number>) => string,
    locale,
  };
}
