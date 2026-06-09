"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTvDashboard } from "@/components/modulo-tv/hooks/useTvDashboard";
import { useLabConfigClient } from "@/lib/use-lab-config-client";
import { TvFooter } from "@/components/modulo-tv/TvFooter";
import { TvHeader } from "@/components/modulo-tv/TvHeader";
import { TvKanbanBoard } from "@/components/modulo-tv/TvKanbanBoard";
import { TvSidebar } from "@/components/modulo-tv/TvSidebar";

export function TvDashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const { nomeLaboratorio } = useLabConfigClient();

  const {
    relogio,
    dataAtual,
    ordens,
    stats,
    carregando,
    wsConectado,
    ultimaAtualizacao,
    fraseMotivacional,
    avisosAtraso,
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

  return (
    <div
      ref={containerRef}
      className="tv-dashboard flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[#050b14] text-slate-100"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.4),#050b14_70%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(56,189,248,0.04)_0%,transparent_40%,rgba(16,185,129,0.03)_100%)]" />

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-2 p-2 2xl:gap-3 2xl:p-4">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <Link
            href="/app/producao/os"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-1.5 text-[11px] text-slate-400 transition hover:border-slate-600 hover:text-white 2xl:text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Sair do painel TV
          </Link>
        </div>

        <TvHeader
          nomeLaboratorio={nomeLaboratorio}
          relogio={relogio}
          dataAtual={dataAtual}
          wsConectado={wsConectado}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
        />

        <div className="flex min-h-0 flex-1 gap-2 overflow-hidden 2xl:gap-3">
          <TvSidebar stats={stats} />
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <TvKanbanBoard ordens={ordens} carregando={carregando} />
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
