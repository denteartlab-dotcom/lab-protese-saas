"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import {
  carregarVozesLocutorTv,
  chaveHoraCheiaLocutor,
  desbloquearAudioLocutorTv,
  falarTextoLocutorTv,
  INTERVALO_LOCUTOR_TV_MS,
  locutorDentroDoHorarioAviso,
  locutorDeveAnunciarHora,
  montarFalaHoraAtual,
  montarFalaLocutorTv,
  msAteProximaHoraCheia,
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
  const horaFaladaRef = useRef("");
  const falandoRef = useRef(false);

  const resumo = useMemo(
    () => resumoEntregasLocutorTv(ordens, locale),
    [ordens, locale]
  );

  const falarTrabalhos = useCallback(
    async (forcar = false) => {
      if (!locutorIaAtivo && !forcar) return;
      if (!ttsDisponivelLocutorTv()) return;
      if (!forcar && !locutorDentroDoHorarioAviso()) return;
      if (falandoRef.current) return;
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

  const falarHora = useCallback(
    async (tentativa = 0) => {
      if (!locutorIaAtivo) return;
      if (!ttsDisponivelLocutorTv()) return;
      const agora = new Date();
      if (!locutorDeveAnunciarHora(agora)) return;

      const chave = chaveHoraCheiaLocutor(agora);
      if (horaFaladaRef.current === chave) return;

      if (falandoRef.current) {
        if (tentativa >= 8) return;
        window.setTimeout(() => void falarHora(tentativa + 1), 2000);
        return;
      }

      horaFaladaRef.current = chave;
      falandoRef.current = true;
      setFalando(true);
      setPrecisaToque(false);
      try {
        await falarTextoLocutorTv(montarFalaHoraAtual(agora, locale), locale, "movida");
      } finally {
        falandoRef.current = false;
        setFalando(false);
      }
    },
    [locale, locutorIaAtivo]
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
      void falarTrabalhos();
    }, INTERVALO_LOCUTOR_TV_MS);
    return () => window.clearInterval(timer);
  }, [dadosCarregados, falarTrabalhos, locutorIaAtivo]);

  useEffect(() => {
    if (!locutorIaAtivo || !dadosCarregados || precisaToque) return;
    if (!resumo.chave || resumo.chave === chaveFaladaRef.current) return;
    const timer = window.setTimeout(() => {
      void falarTrabalhos();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [dadosCarregados, falarTrabalhos, locutorIaAtivo, precisaToque, resumo.chave]);

  useEffect(() => {
    if (!locutorIaAtivo) return;

    let timeoutId = 0;
    let cancelled = false;

    const agendarProximaHora = () => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        void falarHora();
        if (!cancelled) agendarProximaHora();
      }, msAteProximaHoraCheia());
    };

    const agora = new Date();
    if (agora.getMinutes() === 0 && locutorDeveAnunciarHora(agora)) {
      void falarHora();
    }
    agendarProximaHora();

    const pollId = window.setInterval(() => {
      const atual = new Date();
      if (atual.getMinutes() === 0) void falarHora();
    }, 20_000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(pollId);
    };
  }, [falarHora, locutorIaAtivo]);

  useEffect(() => () => pararFalaLocutorTv(), []);

  return {
    falando,
    precisaToque,
    ttsDisponivel: ttsDisponivelLocutorTv(),
    aoLigar: () => {
      desbloquearAudioLocutorTv();
      if (!locutorDentroDoHorarioAviso()) return Promise.resolve();
      chaveFaladaRef.current = "";
      return falarTrabalhos(true);
    },
    falarAgora: () => {
      chaveFaladaRef.current = "";
      return falarTrabalhos(true);
    },
  };
}
