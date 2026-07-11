"use client";

import { useTrUi } from "@/lib/i18n/use-tr-ui";

/** Traduz texto literal em português via catálogo i18n. */
export function Tr({ children }: { children: string }) {
  const { tr } = useTrUi();
  return tr(children);
}
