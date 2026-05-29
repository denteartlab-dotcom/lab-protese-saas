"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PermissaoCrud } from "@/lib/usuarios-sistema";

type PermissoesAppContextValue = {
  acessoTotal: boolean;
  permissoesModulos: Record<string, PermissaoCrud>;
};

const PermissoesAppContext = createContext<PermissoesAppContextValue | null>(null);

export function usePermissoesApp() {
  const ctx = useContext(PermissoesAppContext);
  if (!ctx) {
    return { acessoTotal: true, permissoesModulos: {} as Record<string, PermissaoCrud> };
  }
  return ctx;
}

type Props = PermissoesAppContextValue & { children: ReactNode };

export function PermissoesAppProvider({
  acessoTotal,
  permissoesModulos,
  children,
}: Props) {
  return (
    <PermissoesAppContext.Provider value={{ acessoTotal, permissoesModulos }}>
      {children}
    </PermissoesAppContext.Provider>
  );
}
