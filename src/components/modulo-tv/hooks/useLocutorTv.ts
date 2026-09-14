"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import {
  carregarVozesLocutorTv,
  falarTextoLocutorTv,
  INTERVALO_LOCUTOR_TV_MS,
  locutorDentroDoHorarioAviso,
  montarFalaLocutorTv,
  pararFalaLocutorTv,
  resumoEntregasLocutorTv,
  ttsDisponivelLocutorTv,
} from "@/components/modulo-tv/lib/locutor-tv";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import type { OrdemServicoTv } from "@/components/modulo-tv/types";

export function useLocutorTv(ordens: OrdemServicoTv[], dadosCarregados: boolean) {
  const { locale } = useI18n();
  const locutorIaAtivo = useTvDashboardStore((s) => s.locutorIaAtivo);
  const [falando, setFalando] = useState(false);
  const [precisaToque, setPrecisaToque] = useState(false);
  const chaveFaladaRef = useRef("");
  const falandoRef = useRef(false);

  const resumo = useMemo(
    () => resumoEntregasLocutorTv(ordens, locale),
    [ordens, locale]
  );

  const falar = useCallback(
    async (forcar = false) => {
      if (!locutorIaAtivo && !forcar) return;
      if (!ttsDisponivelLocutorTv()) return;
      if (falandoRef.current) return;
      if (!forcar && !locutorDentroDoHorarioAviso()) return;
      if (!forcar && chaveFaladaRef.current === resumo.chave) return;

      falandoRef.current = true;
      setFalando(true);
      setPrecisaToque(false);
      chaveFaladaRef.current = resumo.chave;
      try {
        await falarTextoLocutorTv(montarFalaLocutorTv(resumo, locale), locale);
      } finally {
        falandoRef.current = false;
        setFalando(false);
      }
    },
    [locale, locutorIaAtivo, resumo]
  );

  useEffect(() => {
    carregarVozesLocutorTv();
  }, []);

  useEffect(() => {
    if (!locutorIaAtivo) {
      pararFalaLocutorTv();
      setFalando(false);
      falandoRef.current = false;
      setPrecisaToque(false);
      return;
    }
    if (!chaveFaladaRef.current) setPrecisaToque(true);
  }, [locutorIaAtivo]);

  useEffect(() => {
    if (!locutorIaAtivo || !dadosCarregados) return;
    const timer = window.setInterval(() => {
      chaveFaladaRef.current = "";
      void falar();
    }, INTERVALO_LOCUTOR_TV_MS);
    return () => window.clearInterval(timer);
  }, [dadosCarregados, falar, locutorIaAtivo]);

  useEffect(() => {
    if (!locutorIaAtivo || !dadosCarregados || precisaToque) return;
    if (!resumo.chave || resumo.chave === chaveFaladaRef.current) return;
    const timer = window.setTimeout(() => {
      void falar();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [dadosCarregados, falar, locutorIaAtivo, precisaToque, resumo.chave]);

  useEffect(() => () => pararFalaLocutorTv(), []);

  return {
    falando,
    precisaToque,
    ttsDisponivel: ttsDisponivelLocutorTv(),
    falarAgora: () => {
      chaveFaladaRef.current = "";
      return falar(true);
    },
  };
}
