"use client";

import { differenceInCalendarDays, startOfDay } from "date-fns";
import { useEffect, useState } from "react";

function formatarDuracaoDias(etapaDesde: Date) {
  const hoje = startOfDay(new Date());
  const inicio = startOfDay(etapaDesde);
  const dias = Math.max(0, differenceInCalendarDays(hoje, inicio));
  if (dias === 0) return "hoje";
  if (dias === 1) return "1 dia";
  return `${dias} dias`;
}

export function useEtapaTempo(etapaDesde: string) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const atualizar = () => {
      const inicio = new Date(etapaDesde);
      if (Number.isNaN(inicio.getTime())) {
        setLabel("—");
        return;
      }
      setLabel(formatarDuracaoDias(inicio));
    };
    atualizar();
    const t = window.setInterval(atualizar, 60_000);
    return () => window.clearInterval(t);
  }, [etapaDesde]);

  return label;
}
