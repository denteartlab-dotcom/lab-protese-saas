"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Executa init após montagem (bootstrap do JsonStore já concluído pelo provider).
 */
export function usePageReady(init: () => void | Promise<void>) {
  const [ready, setReady] = useState(false);
  const initRef = useRef(init);
  initRef.current = init;

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(initRef.current()).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
