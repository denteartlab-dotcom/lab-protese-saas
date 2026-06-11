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
  const { modoKiosk, fullscreenAuto } = useTvDashboardStore();

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
        "tv-dashboard relative flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[#070b12] text-slate-100",
        modoKiosk && "tv-kiosk"
      )}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,58,138,0.15),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(88,28,135,0.08),transparent_50%)]" />

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-3 p-3 tv:gap-3.5 tv:p-4 tv-4k:gap-4 tv-4k:p-5">
        {!modoKiosk ? (
          <Link
            href="/app"
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-1.5 text-[11px] text-slate-400 transition hover:text-white tv:text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
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

        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden tv:gap-4 tv-4k:gap-5">
          <TvSidebar stats={stats} />
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
          totalAtrasadas={stats.atrasadas}
          maioresAtrasos={maioresAtrasos}
          wsConectado={wsConectado}
        />
      </div>
    </div>
  );
}
