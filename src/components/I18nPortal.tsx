"use client";

import { useTrUi } from "@/lib/i18n/use-tr-ui";
import { trUiArvore } from "@/lib/i18n/tr-ui-arvore";
import type { ReactNode } from "react";

/** Traduz automaticamente textos e labels dentro de modais/portais. */
export function I18nPortal({ children }: { children: ReactNode }) {
  const { t } = useTrUi();
  return trUiArvore(children, t);
}
