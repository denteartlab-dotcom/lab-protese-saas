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
  fullscreen: boolean;
  onToggleFullscreen: () => void;
};

export function TvHeader({
  nomeLaboratorio,
  relogio,
  dataAtual,
  wsConectado,
  fullscreen,
  onToggleFullscreen,
}: Props) {
  return (
    <header
      className={cn(
        "relative shrink-0 overflow-hidden px-4 py-3.5 tv:px-6 tv:py-4 tv-4k:px-8 tv-4k:py-5",
        TV_GLASS_PANEL,
        "shadow-[0_0_60px_rgba(59,130,246,0.1),0_0_80px_rgba(139,92,246,0.06)]"
      )}
    >
      {/* Glow superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.14),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.1),transparent_45%)]" />

      <div className="relative flex flex-wrap items-center justify-between gap-4 tv:gap-6">
        <div className="flex items-center gap-4 tv:gap-5">
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-cyan-400/40 to-violet-600/40 blur-md" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 shadow-[0_0_32px_rgba(34,211,238,0.4)] tv:h-14 tv:w-14 tv-4k:h-16 tv-4k:w-16">
              <span className="text-lg font-black tracking-tight text-white tv:text-xl tv-4k:text-2xl">
                SP
              </span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-400/90 tv:text-[11px] tv-4k:text-xs">
              Smart Prótese 2.0
            </p>
            <h1 className="text-lg font-bold tracking-tight text-white tv:text-2xl tv-4k:text-3xl">
              Painel de Produção
            </h1>
            <p className="mt-0.5 text-xs font-medium text-slate-400 tv:text-sm tv-4k:text-base">
              {nomeLaboratorio}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-2 tv:px-6">
          <motion.p
            key={relogio}
            initial={{ opacity: 0.5, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="font-tv-mono text-4xl font-semibold tabular-nums tracking-tight text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.15)] tv:text-6xl tv-4k:text-7xl"
          >
            {relogio}
          </motion.p>
          <p className="mt-1.5 capitalize text-xs font-medium tracking-wide text-slate-400 tv:text-sm tv-4k:text-base">
            {dataAtual}
          </p>
        </div>

        <div className="flex items-center gap-3 tv:gap-4">
          <div className="hidden flex-col items-end gap-2 sm:flex">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-semibold text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)] backdrop-blur-sm tv:text-xs tv-4k:px-4 tv-4k:py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </span>
              Sistema Online
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium tv:text-xs",
                wsConectado ? "text-cyan-400" : "text-amber-400"
              )}
            >
              <Wifi className="h-3.5 w-3.5 tv:h-4 tv:w-4" />
              {wsConectado ? "WebSocket conectado" : "Reconectando..."}
              <Activity className="h-3 w-3 animate-pulse" />
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleFullscreen}
            title={fullscreen ? "Sair da tela cheia" : "Tela cheia TV"}
            className="rounded-xl border border-white/[0.1] bg-white/[0.05] p-2.5 text-slate-300 backdrop-blur-xl transition-all duration-300 hover:border-cyan-400/35 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_24px_rgba(34,211,238,0.15)] tv:p-3 tv-4k:p-3.5"
          >
            {fullscreen ? (
              <Minimize2 className="h-5 w-5 tv:h-6 tv:w-6" />
            ) : (
              <Maximize2 className="h-5 w-5 tv:h-6 tv:w-6" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
