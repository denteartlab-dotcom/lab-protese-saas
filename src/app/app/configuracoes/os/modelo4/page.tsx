"use client";

import { Suspense } from "react";
import { ConfiguracoesOsModelo4Conteudo } from "@/components/configuracoes/ConfiguracoesOsModelo4Conteudo";

export default function ConfiguracoesOsModelo4Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Carregando…</p>}>
      <ConfiguracoesOsModelo4Conteudo />
    </Suspense>
  );
}
