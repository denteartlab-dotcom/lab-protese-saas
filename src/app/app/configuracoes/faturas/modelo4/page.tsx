"use client";

import { Suspense } from "react";
import { ConfiguracoesFaturaModeloConteudo } from "@/components/configuracoes/ConfiguracoesFaturaModeloConteudo";

export default function ConfiguracoesFaturaModelo4Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Carregando…</p>}>
      <ConfiguracoesFaturaModeloConteudo modeloId="modelo4" />
    </Suspense>
  );
}
