"use client";

import { Suspense } from "react";
import { ConfiguracoesOsModelo3Conteudo } from "@/components/configuracoes/ConfiguracoesOsModelo1Conteudo";

export default function ConfiguracoesOsModelo3Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Carregando…</p>}>
      <ConfiguracoesOsModelo3Conteudo />
    </Suspense>
  );
}
