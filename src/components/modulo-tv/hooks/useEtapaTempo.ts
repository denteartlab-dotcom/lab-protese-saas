"use client";

import { useEffect, useState } from "react";

function formatarDuracao(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "< 1m";
}

export function useEtapaTempo(etapaDesde: string) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const atualizar = () => {
      const inicio = new Date(etapaDesde).getTime();
      if (Number.isNaN(inicio)) {
        setLabel("—");
        return;
      }
      const ms = Date.now() - inicio;
      setLabel(formatarDuracao(ms));
    };
    atualizar();
    const t = window.setInterval(atualizar, 30_000);
    return () => window.clearInterval(t);
  }, [etapaDesde]);

  return label;
}
