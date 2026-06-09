"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTvDashboard } from "@/components/modulo-tv/hooks/useTvDashboard";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import { TvFilters } from "@/components/modulo-tv/TvFilters";
import { useLabConfigClient } from "@/lib/use-lab-config-client";
import { TvFooter } from "@/components/modulo-tv/TvFooter";
import { TvHeader } from "@/components/modulo-tv/TvHeader";
import { TvKanbanBoard } from "@/components/modulo-tv/TvKanbanBoard";
import { TvSidebar } from "@/components/modulo-tv/TvSidebar";
import { cn } from "@/lib/utils";

export function TvDashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const { nomeLaboratorio } = useLabConfigClient();
  const { modoKiosk, fullscreenAuto } = useTvDashboardStore();

  const {
    relogio,
    dataAtual,
    ordens,
    colaboradores,
    stats,
    chartPontos,
    carregando,
    wsConectado,
    ultimaAtualizacao,
    fraseMotivacional,
    avisosAtraso,
    moverOrdem,
  } = useTvDashboard();

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch {
      setFullscreen((v) => !v);
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!fullscreenAuto && !modoKiosk) return;
    const t = window.setTimeout(() => {
      const el = containerRef.current;
      if (!el || document.fullscreenElement) return;
      void el.requestFullscreen().catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [fullscreenAuto, modoKiosk]);

  useEffect(() => {
    if (!modoKiosk) return;
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, [modoKiosk]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "tv-dashboard relative flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[#030712] text-slate-100",
        modoKiosk && "tv-kiosk"
      )}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(30,58,138,0.35),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_50%,rgba(88,28,135,0.18),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_80%,rgba(14,165,233,0.12),transparent_50%)]" />
      <div
        className="tv-grid-bg pointer-events-none fixed inset-0 opacity-[0.35]"
        aria-hidden
      />
      <div className="pointer-events-none fixed -left-32 top-1/4 h-96 w-96 animate-tv-float rounded-full bg-blue-600/10 blur-[100px]" />
      <div
        className="pointer-events-none fixed -right-24 bottom-1/4 h-80 w-80 animate-tv-float rounded-full bg-violet-600/12 blur-[90px]"
        style={{ animationDelay: "-3s" }}
      />
      <div className="pointer-events-none fixed left-1/2 top-0 h-64 w-[600px] -translate-x-1/2 animate-tv-pulse-glow rounded-full bg-cyan-500/8 blur-[80px]" />

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-2.5 p-2.5 tv:gap-3.5 tv:p-4 tv-4k:gap-5 tv-4k:p-6">
        {!modoKiosk ? (
          <div className="flex shrink-0 items-center justify-between gap-2">
            <Link
              href="/app/producao/os"
              className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[11px] font-medium text-slate-400 backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/30 hover:bg-white/[0.07] hover:text-white hover:shadow-[0_0_24px_rgba(34,211,238,0.12)] tv:text-xs tv-4k:px-4 tv-4k:py-2.5 tv-4k:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 tv:h-4 tv:w-4" />
              Sair do painel TV
            </Link>
          </div>
        ) : null}

        <TvHeader
          nomeLaboratorio={nomeLaboratorio}
          relogio={relogio}
          dataAtual={dataAtual}
          wsConectado={wsConectado}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
          modoKiosk={modoKiosk}
        />

        <TvFilters colaboradores={colaboradores} />

        <div className="flex min-h-0 flex-1 gap-2.5 overflow-hidden tv:gap-3.5 tv-4k:gap-5">
          <TvSidebar stats={stats} chartPontos={chartPontos} />
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <TvKanbanBoard
              ordens={ordens}
              carregando={carregando}
              onMoverOrdem={moverOrdem}
            />
          </main>
        </div>

        <TvFooter
          ultimaAtualizacao={ultimaAtualizacao}
          fraseMotivacional={fraseMotivacional}
          avisosAtraso={avisosAtraso}
          wsConectado={wsConectado}
        />
      </div>
    </div>
  );
}
