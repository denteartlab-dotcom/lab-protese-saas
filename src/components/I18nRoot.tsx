"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import { I18nAuto } from "@/components/I18nAuto";

/** Provider i18n + tradução automática de textos PT em toda a árvore React. */
export function I18nRoot({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <I18nAuto>{children}</I18nAuto>
    </I18nProvider>
  );
}
