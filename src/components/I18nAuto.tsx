"use client";

import type { ReactNode } from "react";
import { useTrUi } from "@/lib/i18n/use-tr-ui";

/** Traduz automaticamente textos PT conhecidos na árvore React (catálogo messages). */
export function I18nAuto({ children }: { children: ReactNode }) {
  const { trArvore } = useTrUi();
  return trArvore(children);
}
