"use client";

import { useEffect } from "react";
import { limparCachesAplicacao } from "@/lib/app-cache-recovery";

/** Apaga sessão via API (Route Handler) e limpa cache do navegador. */
export function LimparSessaoCliente() {
  useEffect(() => {
    void fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    })
      .catch(() => undefined)
      .then(() => limparCachesAplicacao())
      .finally(() => {
        window.location.replace(`/login?_fresh=${Date.now()}`);
      });
  }, []);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center text-sm text-slate-600">
      <p>Atualizando sessão e cache do navegador…</p>
      <p className="mt-2 text-xs text-slate-400">Você será redirecionado ao login.</p>
    </div>
  );
}
