"use client";

import { useEffect } from "react";
import { limparCachesAplicacao } from "@/lib/app-cache-recovery";

/** Limpa cache do navegador e redireciona ao login (sessão já apagada no servidor). */
export function LimparSessaoCliente() {
  useEffect(() => {
    void limparCachesAplicacao().finally(() => {
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
