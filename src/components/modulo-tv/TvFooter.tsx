"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useFraseMotivacional } from "@/components/modulo-tv/hooks/useFraseMotivacional";
import { useAnotacoesTvRodape } from "@/components/modulo-tv/hooks/useAnotacoesTvRodape";
import { TV_GLASS_PANEL } from "@/components/modulo-tv/tv-styles";
import type { MaiorAtrasoTv } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

const ROTACAO_ANOTACOES_MS = 8_000;

type Props = {
  ultimaAtualizacao: Date;
  totalAtrasadas: number;
  maioresAtrasos: MaiorAtrasoTv[];
  wsConectado: boolean;
};

function formatHora(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TvFooter({
  ultimaAtualizacao,
  totalAtrasadas,
  maioresAtrasos,
  wsConectado,
}: Props) {
  const fraseMotivacional = useFraseMotivacional(ultimaAtualizacao);
  const [indiceAnotacao, setIndiceAnotacao] = useState(0);
  const { linhaAtual: linhaAnotacao, total: totalAnotacoes } =
    useAnotacoesTvRodape(indiceAnotacao);

  useEffect(() => {
    if (totalAnotacoes <= 1) return;
    const timer = window.setInterval(() => {
      setIndiceAnotacao((i) => (i + 1) % totalAnotacoes);
    }, ROTACAO_ANOTACOES_MS);
    return () => window.clearInterval(timer);
  }, [totalAnotacoes]);

  return (
    <footer className={cn("w-full max-w-none shrink-0 px-2 py-2 tv-hd:px-3 tv-hd:py-2.5 tv:px-4 tv:py-3", TV_GLASS_PANEL)}>
      <div className="grid w-full grid-cols-1 items-center gap-2 tv-hd:grid-cols-3 tv-hd:gap-3">
        {/* Esquerda — ATENÇÃO */}
        <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 tv:px-5 tv:py-3.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-red-400 tv:text-[10px]">
            Atenção
          </p>
          <p className="mt-1 font-tv-mono text-sm font-bold uppercase text-red-300 tv:text-base tv-4k:text-lg">
            {totalAtrasadas} {totalAtrasadas === 1 ? "Ordem Atrasada" : "Ordens Atrasadas"}
          </p>
        </div>

        {/* Centro — maiores atrasos + frase */}
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 tv:text-[10px]">
            Maiores Atrasos
          </p>
          <div className="mt-1.5 space-y-0.5">
            {maioresAtrasos.length > 0 ? (
              maioresAtrasos.map((a) => (
                <p
                  key={a.numeroOs}
                  className="font-tv-mono text-[11px] font-semibold text-red-300/90 tv:text-xs"
                >
                  OS #{a.numeroOs} — {a.dias} {a.dias === 1 ? "dia" : "dias"}
                </p>
              ))
            ) : (
              <p className="text-[11px] text-emerald-400/80 tv:text-xs">
                Nenhum atraso crítico
              </p>
            )}
          </div>
          <div className="mt-2 flex justify-center px-1 tv-hd:mt-2.5">
            <div className="inline-flex max-w-full items-start gap-1 tv-hd:gap-1.5">
              <span
                className="mt-0.5 shrink-0 select-none font-serif text-[15px] leading-none text-slate-500/50 tv-hd:text-[16px] tv:text-[18px]"
                aria-hidden
              >
                “
              </span>
              <AnimatePresence mode="wait">
                <motion.p
                  key={fraseMotivacional}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.45 }}
                  className="max-w-[40ch] text-center text-[13px] leading-snug text-slate-200 tv-hd:text-[13px] tv:text-[14px]"
                >
                  {fraseMotivacional}
                </motion.p>
              </AnimatePresence>
              <span
                className="mt-auto shrink-0 select-none pb-0.5 font-serif text-[15px] leading-none text-slate-500/50 tv-hd:text-[16px] tv:text-[18px]"
                aria-hidden
              >
                ”
              </span>
            </div>
          </div>
        </div>

        {/* Direita — anotações + ÚLTIMA ATUALIZAÇÃO */}
        <div className="rounded-lg border border-slate-600/40 bg-slate-800/40 px-4 py-3 text-right tv:px-5 tv:py-3.5">
          {linhaAnotacao ? (
            <div className="mb-2 border-b border-slate-600/30 pb-2">
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-cyan-400/80 tv:text-[9px]">
                Anotações
              </p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={linhaAnotacao}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.35 }}
                  className="mt-1 truncate text-[10px] leading-snug text-slate-200 tv:text-[11px]"
                  title={linhaAnotacao}
                >
                  {linhaAnotacao}
                </motion.p>
              </AnimatePresence>
            </div>
          ) : null}
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 tv:text-[10px]">
            Última Atualização
          </p>
          <div className="mt-1 flex items-center justify-end gap-2">
            <RefreshCw
              className={cn(
                "h-4 w-4 text-cyan-400 tv:h-5 tv:w-5",
                !wsConectado && "animate-spin text-amber-400"
              )}
            />
            <span className="font-tv-mono text-lg font-bold tabular-nums text-white tv:text-xl tv-4k:text-2xl">
              {formatHora(ultimaAtualizacao)}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
