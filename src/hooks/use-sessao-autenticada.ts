"use client";

import { useEffect, useState } from "react";

/** Verifica se há sessão ativa (cookie JWT) sem deslogar o usuário. */
export function useSessaoAutenticada() {
  const [autenticado, setAutenticado] = useState<boolean | null>(null);

  useEffect(() => {
    let ativo = true;

    void (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (ativo) setAutenticado(res.ok);
      } catch {
        if (ativo) setAutenticado(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  return autenticado;
}
