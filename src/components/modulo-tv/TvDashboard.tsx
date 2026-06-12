"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTvDashboard } from "@/components/modulo-tv/hooks/useTvDashboard";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
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
  const { modoKiosk } = useTvDashboardStore();

  const {
    relogio,
    dataAtual,
    ordens,
    stats,
    carregando,
    wsConectado,
    sistemaOnline,
    ultimaAtualizacao,
    maioresAtrasos,
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
    document.documentElement.classList.add("modo-tv-producao");
    return () => document.documentElement.classList.remove("modo-tv-producao");
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = containerRef.current;
      if (!el || document.fullscreenElement) return;
      void el.requestFullscreen().catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(t);
  }, []);

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
        "tv-dashboard tv-dashboard-root fixed inset-0 z-40 flex h-[100vh] w-[100vw] max-w-none flex-col overflow-hidden bg-[#070b12] text-slate-100",
        modoKiosk && "tv-kiosk"
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,58,138,0.15),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(88,28,135,0.08),transparent_50%)]" />

      <div className="relative z-10 flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-2 p-2 tv-hd:gap-2.5 tv-hd:p-2.5 tv:gap-3 tv:p-3">
        {!modoKiosk ? (
          <Link
            href="/app"
            className="absolute left-2 top-2 z-20 inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-900/80 px-2.5 py-1 text-[10px] text-slate-400 backdrop-blur-sm transition hover:text-white tv-hd:text-[11px] tv:text-xs"
          >
            <ArrowLeft className="h-3 w-3 tv-hd:h-3.5 tv-hd:w-3.5" />
            Sair do painel TV
          </Link>
        ) : null}

        <TvHeader
          nomeLaboratorio={nomeLaboratorio}
          relogio={relogio}
          dataAtual={dataAtual}
          wsConectado={wsConectado}
          sistemaOnline={sistemaOnline}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
          modoKiosk={modoKiosk}
        />

        <div className="flex min-h-0 w-full max-w-none flex-1 gap-2 overflow-hidden tv-hd:gap-2.5 tv:gap-3">
          <TvSidebar stats={stats} />
          <main className="min-h-0 min-w-0 w-full max-w-none flex-1 overflow-hidden">
            <TvKanbanBoard
              ordens={ordens}
              carregando={carregando}
              onMoverOrdem={moverOrdem}
            />
          </main>
        </div>

        <TvFooter
          ultimaAtualizacao={ultimaAtualizacao}
          totalAtrasadas={stats.atrasadas}
          maioresAtrasos={maioresAtrasos}
          wsConectado={wsConectado}
        />
      </div>
    </div>
  );
}
