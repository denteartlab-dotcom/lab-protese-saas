"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, RefreshCw, Sparkles } from "lucide-react";

type Props = {
  ultimaAtualizacao: Date;
  fraseMotivacional: string;
  avisosAtraso: string[];
  wsConectado: boolean;
};

function formatUltimaAtualizacao(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TvFooter({
  ultimaAtualizacao,
  fraseMotivacional,
  avisosAtraso,
  wsConectado,
}: Props) {
  return (
    <footer className="shrink-0 rounded-xl border border-slate-700/50 bg-slate-900/70 px-4 py-2.5 2xl:py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 2xl:text-xs">
          <RefreshCw
            className={`h-3.5 w-3.5 ${wsConectado ? "text-cyan-400" : "animate-spin text-amber-400"}`}
          />
          <span>
            Última atualização:{" "}
            <strong className="font-semibold text-slate-200">
              {formatUltimaAtualizacao(ultimaAtualizacao)}
            </strong>
          </span>
          <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:inline" />
          <span className="hidden text-cyan-500/80 sm:inline">
            Tempo real ativo
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={fraseMotivacional}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex max-w-xl items-center gap-2 text-center text-[11px] italic text-slate-400 2xl:text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
            {fraseMotivacional}
          </motion.p>
        </AnimatePresence>

        <div className="flex max-w-md items-center gap-2 text-[11px] 2xl:text-xs">
          {avisosAtraso.length > 0 ? (
            <>
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span className="truncate font-medium text-red-300/90">
                {avisosAtraso.join(" · ")}
              </span>
            </>
          ) : (
            <span className="text-emerald-400/90">Nenhum atraso crítico</span>
          )}
        </div>
      </div>
    </footer>
  );
}
