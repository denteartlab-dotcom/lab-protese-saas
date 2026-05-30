"use client";

import { usePathname } from "next/navigation";
import { AppFaixaTopo } from "@/components/AppFaixaTopo";

/** Login e páginas públicas — mesma faixa cinza estreita da referência. */
export function SiteTopoMarca() {
  const pathname = usePathname() ?? "";

  if (
    pathname === "/login" ||
    pathname.includes("/imprimir") ||
    pathname.startsWith("/app")
  ) {
    return null;
  }

  return <AppFaixaTopo esquerda={null} direita={null} logoHref="/login" />;
}
