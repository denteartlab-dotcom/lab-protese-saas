"use client";

import { Suspense } from "react";
import { ConfiguracoesOsModelo2Conteudo } from "@/components/configuracoes/ConfiguracoesOsModelo1Conteudo";

export default function ConfiguracoesOsModelo2Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Carregando…</p>}>
      <ConfiguracoesOsModelo2Conteudo />
    </Suspense>
  );
}
