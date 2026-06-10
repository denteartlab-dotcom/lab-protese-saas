"use client";

import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useFraseMotivacional } from "@/components/modulo-tv/hooks/useFraseMotivacional";
import { TV_GLASS_PANEL } from "@/components/modulo-tv/tv-styles";
import type { MaiorAtrasoTv } from "@/components/modulo-tv/types";
import { cn } from "@/lib/utils";

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

  return (
    <footer className={cn("shrink-0 px-3 py-3 tv:px-5 tv:py-3.5 tv-4k:px-6 tv-4k:py-4", TV_GLASS_PANEL)}>
      <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_1.4fr_1fr] lg:gap-4">
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
          <div className="mx-auto mt-3 flex min-h-[3rem] max-w-xl items-start justify-center gap-1 tv:min-h-[3.25rem] tv:gap-1.5 tv-4k:min-h-[3.5rem]">
            <span
              className="mt-0.5 shrink-0 select-none font-serif text-2xl leading-none text-slate-500/35 tv:text-3xl tv-4k:text-4xl"
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
                className="min-w-0 flex-1 text-center text-[10px] leading-relaxed text-slate-200 tv:text-[11px] tv-4k:text-xs"
              >
                {fraseMotivacional}
              </motion.p>
            </AnimatePresence>
            <span
              className="shrink-0 self-end select-none font-serif text-2xl leading-none text-slate-500/35 tv:text-3xl tv-4k:text-4xl"
              aria-hidden
            >
              ”
            </span>
          </div>
        </div>

        {/* Direita — ÚLTIMA ATUALIZAÇÃO */}
        <div className="rounded-lg border border-slate-600/40 bg-slate-800/40 px-4 py-3 text-right tv:px-5 tv:py-3.5">
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
