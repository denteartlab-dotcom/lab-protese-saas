"use client";

import { usePathname } from "next/navigation";
import { AppFaixaTopo } from "@/components/AppFaixaTopo";
import { useSessaoAutenticada } from "@/hooks/use-sessao-autenticada";

/** Login e páginas públicas — mesma faixa cinza estreita da referência. */
export function SiteTopoMarca() {
  const pathname = usePathname() ?? "";
  const autenticado = useSessaoAutenticada();

  if (
    pathname === "/login" ||
    pathname.includes("/imprimir") ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/extrato/") ||
    pathname.startsWith("/fatura/") ||
    pathname.startsWith("/assinatura-vencida") ||
    pathname.startsWith("/pagamento")
  ) {
    return null;
  }

  const logoHref =
    autenticado === null ? "/login" : autenticado ? "/app" : "/login";

  return <AppFaixaTopo esquerda={null} direita={null} logoHref={logoHref} />;
}
