"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Executa init após o bootstrap do JsonStore (dados do PostgreSQL) estar pronto.
 */
import { aguardarArmazenamentoLaboratorioPronto } from "@/lib/armazenamento-laboratorio";

export function usePageReady(init: () => void | Promise<void>) {
  const [ready, setReady] = useState(false);
  const initRef = useRef(init);
  initRef.current = init;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await aguardarArmazenamentoLaboratorioPronto();
      if (cancelled) return;
      await Promise.resolve(initRef.current());
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
