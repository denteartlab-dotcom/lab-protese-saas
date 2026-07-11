"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ANOTACOES_ATUALIZADO_EVENT,
  lerAnotacoesDashboard,
  type AnotacaoDashboard,
} from "@/lib/anotacoes-dashboard";
import { ARMAZENAMENTO_LAB_PRONTO_EVENT } from "@/lib/armazenamento-laboratorio";

function formatarDataAnotacaoTv(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function textoLinhaAnotacaoTv(anotacao: AnotacaoDashboard) {
  const data = formatarDataAnotacaoTv(anotacao.criadoEm);
  const texto = anotacao.texto.replace(/\s+/g, " ").trim();
  const autor = anotacao.autor?.trim();
  if (autor) return `${autor} · ${data} — ${texto}`;
  return `${data} — ${texto}`;
}

export function useAnotacoesTvRodape(indiceRotacao: number) {
  const [lista, setLista] = useState<AnotacaoDashboard[]>([]);

  const recarregar = useCallback(() => {
    setLista(lerAnotacoesDashboard());
  }, []);

  useEffect(() => {
    recarregar();
    window.addEventListener(ANOTACOES_ATUALIZADO_EVENT, recarregar);
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, recarregar);
    return () => {
      window.removeEventListener(ANOTACOES_ATUALIZADO_EVENT, recarregar);
      window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, recarregar);
    };
  }, [recarregar]);

  const linhaAtual = useMemo(() => {
    if (lista.length === 0) return null;
    const idx = indiceRotacao % lista.length;
    return textoLinhaAnotacaoTv(lista[idx]!);
  }, [indiceRotacao, lista]);

  return { linhaAtual, total: lista.length };
}
