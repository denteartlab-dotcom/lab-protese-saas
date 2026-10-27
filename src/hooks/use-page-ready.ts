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
    const limite = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 20000);
    void (async () => {
      try {
        await aguardarArmazenamentoLaboratorioPronto();
        if (cancelled) return;
        try {
          await Promise.resolve(initRef.current());
        } catch (err) {
          console.error("[usePageReady]", err);
        }
      } finally {
        window.clearTimeout(limite);
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(limite);
    };
  }, []);

  return ready;
}
