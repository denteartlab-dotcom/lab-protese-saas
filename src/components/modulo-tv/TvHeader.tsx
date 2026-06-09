"use client";

import { motion } from "framer-motion";
import { Activity, Maximize2, Minimize2, Wifi } from "lucide-react";
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
    <header className="relative shrink-0 overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-950/95 px-4 py-3 shadow-[0_0_40px_rgba(14,165,233,0.08)] 2xl:px-6 2xl:py-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.12),transparent_55%)]" />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_24px_rgba(34,211,238,0.35)] 2xl:h-14 2xl:w-14">
            <span className="text-lg font-black text-white 2xl:text-xl">SP</span>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400/90 2xl:text-xs">
              Smart Prótese 2.0
            </p>
            <h1 className="text-lg font-bold text-white 2xl:text-2xl">
              Painel de Produção
            </h1>
            <p className="text-xs text-slate-400 2xl:text-sm">{nomeLaboratorio}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <motion.p
            key={relogio}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            className="font-mono text-4xl font-bold tabular-nums tracking-tight text-white 2xl:text-6xl 4xl:text-7xl"
          >
            {relogio}
          </motion.p>
          <p className="mt-1 capitalize text-xs text-slate-400 2xl:text-sm">
            {dataAtual}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden flex-col items-end gap-1 sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Online
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium",
                wsConectado ? "text-cyan-400" : "text-amber-400"
              )}
            >
              <Wifi className="h-3.5 w-3.5" />
              {wsConectado ? "WebSocket conectado" : "Reconectando..."}
              <Activity className="h-3 w-3 animate-pulse" />
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleFullscreen}
            title={fullscreen ? "Sair da tela cheia" : "Tela cheia TV"}
            className="rounded-lg border border-slate-600/60 bg-slate-800/60 p-2.5 text-slate-300 transition hover:border-cyan-500/40 hover:bg-slate-700/80 hover:text-white"
          >
            {fullscreen ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
