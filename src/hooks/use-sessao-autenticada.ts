"use client";

import { useEffect, useState } from "react";

/** Verifica se há sessão ativa (cookie JWT) sem deslogar o usuário. */
export function useSessaoAutenticada(consultar = true) {
  const [autenticado, setAutenticado] = useState<boolean | null>(consultar ? null : false);

  useEffect(() => {
    if (!consultar) {
      setAutenticado(false);
      return;
    }

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
  }, [consultar]);

  return autenticado;
}
