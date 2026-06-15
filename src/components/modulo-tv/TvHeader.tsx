"use client";

import { motion } from "framer-motion";
import { Activity, Maximize2, Minimize2, Wifi } from "lucide-react";
import { TV_GLASS_PANEL } from "@/components/modulo-tv/tv-styles";
import { cn } from "@/lib/utils";

type Props = {
  nomeLaboratorio: string;
  relogio: string;
  dataAtual: string;
  wsConectado: boolean;
  sistemaOnline?: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  modoKiosk?: boolean;
};

export function TvHeader({
  nomeLaboratorio,
  relogio,
  dataAtual,
  wsConectado,
  sistemaOnline = wsConectado,
  fullscreen,
  onToggleFullscreen,
  modoKiosk = false,
}: Props) {
  const statusLabel = wsConectado
    ? "Sistema Online"
    : "Reconectando";
  const statusHint = wsConectado
    ? "Tempo real ativo"
    : "Atualização automática";

  return (
    <header
      className={cn(
        "relative w-full max-w-none shrink-0 px-3 py-2 tv-hd:px-4 tv-hd:py-2.5 tv:px-5 tv:py-3",
        TV_GLASS_PANEL
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Esquerda */}
        <div className="flex min-w-0 items-center gap-3 tv:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.25)] tv:h-12 tv:w-12 tv-4k:h-14 tv-4k:w-14">
            <img
              src="/favicon.svg"
              alt="LaboPrótese"
              width={56}
              height={56}
              className="h-full w-full object-cover"
              decoding="async"
              fetchPriority="high"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 tv:text-[11px]">
              LaboPrótese
              {modoKiosk ? (
                <span className="ml-2 rounded bg-violet-500/20 px-1.5 py-0.5 text-[8px] text-violet-200">
                  KIOSK
                </span>
              ) : null}
            </p>
            <h1 className="truncate text-base font-bold text-white tv:text-xl tv-4k:text-2xl">
              Painel de Produção
            </h1>
            <p className="truncate text-xs text-slate-400 tv:text-sm">
              {nomeLaboratorio}
            </p>
          </div>
        </div>

        {/* Centro — relógio */}
        <div className="hidden flex-1 flex-col items-center sm:flex">
          <motion.p
            key={relogio}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            className="font-tv-mono text-3xl font-semibold tabular-nums text-white tv:text-5xl tv-4k:text-6xl"
          >
            {relogio}
          </motion.p>
          <p className="mt-0.5 capitalize text-[11px] text-slate-400 tv:text-sm">
            {dataAtual}
          </p>
        </div>

        {/* Direita */}
        <div className="flex shrink-0 items-center gap-2.5 tv:gap-3">
          <div className="hidden flex-col items-end gap-1.5 md:flex">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold tv:text-[11px]",
                sistemaOnline
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-300"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  sistemaOnline
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                    : "animate-pulse bg-amber-400"
                )}
              />
              {statusLabel}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] tv:text-[11px]",
                sistemaOnline ? "text-cyan-400" : "text-amber-400"
              )}
            >
              <Wifi className="h-3 w-3" />
              {statusHint}
              <Activity
                className={cn("h-2.5 w-2.5", !sistemaOnline && "animate-pulse")}
              />
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={fullscreen ? "Sair da tela cheia" : "Tela cheia TV"}
            className="rounded-lg border border-slate-600/50 bg-slate-800/50 p-2 text-slate-300 transition hover:border-blue-500/40 hover:text-white tv:p-2.5"
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4 tv:h-5 tv:w-5" />
            ) : (
              <Maximize2 className="h-4 w-4 tv:h-5 tv:w-5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
