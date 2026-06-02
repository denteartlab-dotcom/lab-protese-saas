"use client";

import { Suspense } from "react";
import { ConfiguracoesCabecalhoConteudo } from "@/components/configuracoes/ConfiguracoesCabecalhoConteudo";

export default function ConfiguracoesCabecalhoPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Carregando…</p>}>
      <ConfiguracoesCabecalhoConteudo />
    </Suspense>
  );
}
