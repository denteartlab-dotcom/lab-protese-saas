"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { TV_GLASS_PANEL } from "@/components/modulo-tv/tv-styles";
import { cn } from "@/lib/utils";

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
    <footer
      className={cn(
        "relative shrink-0 overflow-hidden px-4 py-3 tv:px-6 tv:py-3.5 tv-4k:px-8 tv-4k:py-4",
        TV_GLASS_PANEL
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

      <div className="relative flex flex-wrap items-center justify-between gap-3 tv:gap-4">
        <div className="flex items-center gap-2.5 text-[11px] text-slate-400 tv:text-xs tv-4k:text-sm">
          <RefreshCw
            className={cn(
              "h-3.5 w-3.5 tv:h-4 tv:w-4",
              wsConectado ? "text-cyan-400" : "animate-spin text-amber-400"
            )}
          />
          <span>
            Última atualização:{" "}
            <strong className="font-tv-mono font-semibold text-slate-200">
              {formatUltimaAtualizacao(ultimaAtualizacao)}
            </strong>
          </span>
          <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:inline" />
          <span className="hidden font-medium text-cyan-500/80 sm:inline">
            Tempo real ativo
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={fraseMotivacional}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="flex max-w-xl items-center gap-2.5 text-center text-[11px] italic text-slate-400 tv:text-xs tv-4k:text-sm"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400/90 tv:h-4 tv:w-4" />
            {fraseMotivacional}
          </motion.p>
        </AnimatePresence>

        <div className="flex max-w-md items-center gap-2 text-[11px] tv:text-xs tv-4k:text-sm">
          {avisosAtraso.length > 0 ? (
            <>
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 tv:h-5 tv:w-5" />
              <span className="truncate font-medium text-red-300/95">
                {avisosAtraso.join(" · ")}
              </span>
            </>
          ) : (
            <span className="font-medium text-emerald-400/95">
              Nenhum atraso crítico
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
