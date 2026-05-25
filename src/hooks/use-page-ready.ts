"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Aguarda carregar localStorage/API antes de exibir listas.
 * Evita o "flash" de dados padrão que somem após o hydrate.
 */
export function usePageReady(init: () => void | Promise<void>) {
  const [ready, setReady] = useState(false);
  const initRef = useRef(init);
  initRef.current = init;

  useEffect(() => {
    let cancelled = false;

    async function run() {
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
