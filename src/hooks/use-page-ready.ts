"use client";

import { useEffect, useRef, useState } from "react";
import {
  armazenamentoLaboratorioPronto,
  inicializarArmazenamentoLaboratorio,
} from "@/lib/armazenamento-laboratorio";

/**
 * Aguarda hidratar dados do servidor (JsonStore) antes de exibir listas.
 */
export function usePageReady(init: () => void | Promise<void>) {
  const [ready, setReady] = useState(false);
  const initRef = useRef(init);
  initRef.current = init;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!armazenamentoLaboratorioPronto()) {
        await inicializarArmazenamentoLaboratorio();
      }
      await initRef.current();
      if (!cancelled) setReady(true);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
