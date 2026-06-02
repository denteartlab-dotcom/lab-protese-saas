"use client";

import { Suspense } from "react";
import { ConfiguracoesOsModelo5Conteudo } from "@/components/configuracoes/ConfiguracoesOsModelo5Conteudo";

export default function ConfiguracoesOsModelo5Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Carregando…</p>}>
      <ConfiguracoesOsModelo5Conteudo />
    </Suspense>
  );
}
