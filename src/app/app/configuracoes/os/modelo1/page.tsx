"use client";

import { Suspense } from "react";
import { ConfiguracoesOsModelo1Conteudo } from "@/components/configuracoes/ConfiguracoesOsModelo1Conteudo";

export default function ConfiguracoesOsModelo1Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Carregando…</p>}>
      <ConfiguracoesOsModelo1Conteudo />
    </Suspense>
  );
}
