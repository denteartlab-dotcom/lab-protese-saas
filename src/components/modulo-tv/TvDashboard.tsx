"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { useTvDashboard } from "@/components/modulo-tv/hooks/useTvDashboard";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import { useLabConfigClient } from "@/lib/use-lab-config-client";
import { TvFooter } from "@/components/modulo-tv/TvFooter";
import { TvHeader } from "@/components/modulo-tv/TvHeader";
import { TvKanbanBoard } from "@/components/modulo-tv/TvKanbanBoard";
import { TvLocutorIa } from "@/components/modulo-tv/TvLocutorIa";
import { TvSetorAbas } from "@/components/modulo-tv/TvSetorAbas";
import { TvSidebar } from "@/components/modulo-tv/TvSidebar";
import type { OrdemServicoTv } from "@/components/modulo-tv/types";
import {
  chaveNomeTv,
  colunasKanbanDaVista,
  colunaIdDaOrdemVisaoGeral,
  idColunaDaOrdemNaVista,
  idColunaSetorVista,
  mesclarLayoutTvComPadroes,
  ordemVisivelNoSetorTv,
  resolverSetorVistaTv,
  VISTA_TV_TODOS,
  type TvLayoutSetores,
} from "@/lib/tv/tv-colunas-setor";
import { cn } from "@/lib/utils";

export function TvDashboard() {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const { nomeLaboratorio } = useLabConfigClient();
  const { modoKiosk, vistaSetor, setVistaSetor } = useTvDashboardStore();

  const {
    relogio,
    dataAtual,
    ordens,
    stats,
    colaboradores,
    carregando,
    erroCarregamento,
    wsConectado,
    sistemaOnline,
    ultimaAtualizacao,
    maioresAtrasos,
    moverOrdem,
    recarregar,
    dadosCarregados,
    layoutSetores,
  } = useTvDashboard();

  const layout = useMemo<TvLayoutSetores>(
    () =>
      mesclarLayoutTvComPadroes({
        setores: layoutSetores.setores ?? [],
        etapas: layoutSetores.etapas ?? [],
      }),
    [layoutSetores]
  );

  const vista = resolverSetorVistaTv(vistaSetor, layout.setores);

  // Só normaliza o nome canônico do setor — nunca reseta para "todos".
  useEffect(() => {
    if (layout.setores.length === 0) return;
    if (!vistaSetor || vistaSetor === VISTA_TV_TODOS) return;
    const match = layout.setores.find(
      (setor) => chaveNomeTv(setor.nome) === chaveNomeTv(vistaSetor)
    );
    if (match && match.nome !== vistaSetor) setVistaSetor(match.nome);
  }, [layout.setores, setVistaSetor, vistaSetor]);

  const ordensVista = useMemo(
    () =>
      vista === VISTA_TV_TODOS
        ? ordens
        : ordens.filter((ordem) => ordemVisivelNoSetorTv(ordem, vista, layout)),
    [layout, ordens, vista]
  );

  const colunas = useMemo(
    () =>
      colunasKanbanDaVista(
        vista,
        layout,
        {
          outras: t("producao.tv.setores.outras"),
          semSetor: t("producao.tv.setores.semSetor"),
        },
        ordensVista
      ),
    [layout, ordensVista, t, vista]
  );

  const colunaIdPorOrdem = useCallback(
    (ordem: OrdemServicoTv) => idColunaDaOrdemNaVista(ordem, vista, layout),
    [layout, vista]
  );

  const contagensSetor = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const setor of layout.setores) {
      const id = idColunaSetorVista(setor.nome);
      mapa[chaveNomeTv(setor.nome)] = ordens.filter(
        (ordem) => colunaIdDaOrdemVisaoGeral(ordem, layout) === id
      ).length;
    }
    return mapa;
  }, [layout, ordens]);

  const permitirArrastar = false;

  const [socketServidorAtivo, setSocketServidorAtivo] = useState<boolean | null>(null);

  useEffect(() => {
    let ativo = true;
    void fetch("/api/tv/socket-health", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { socketIoAtivo?: boolean } | null) => {
        if (!ativo) return;
        setSocketServidorAtivo(Boolean(data?.socketIoAtivo));
      })
      .catch(() => {
        if (ativo) setSocketServidorAtivo(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

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
    if (!modoKiosk) return;
    const t = window.setTimeout(() => {
      const el = containerRef.current;
      if (!el || document.fullscreenElement) return;
      void el.requestFullscreen().catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(t);
  }, [modoKiosk]);

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

        {socketServidorAtivo === false ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-[11px] text-amber-200 tv:text-xs">
            {t("producao.tv.tempoRealIndisponivel")}
          </div>
        ) : null}

        {erroCarregamento ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200 tv:text-xs">
            <span>{t("producao.tv.erroCarregar")}</span>
            <button
              type="button"
              onClick={() => void recarregar()}
              className="shrink-0 rounded-md border border-red-400/40 px-2.5 py-1 font-semibold text-red-100 transition hover:bg-red-500/20"
            >
              {t("producao.tv.tentarNovamente")}
            </button>
          </div>
        ) : null}

        <div className="flex min-h-0 w-full max-w-none flex-1 gap-2 overflow-hidden tv-hd:gap-2.5 tv:gap-3">
          <TvSidebar stats={stats} colaboradores={colaboradores}>
            <TvLocutorIa ordens={ordensVista} dadosCarregados={dadosCarregados} />
            <TvSetorAbas
              setores={layout.setores}
              selecionado={vista}
              onChange={setVistaSetor}
              contagens={contagensSetor}
              total={ordens.length}
            />
          </TvSidebar>
          <main className="flex min-h-0 min-w-0 w-full max-w-none flex-1 flex-col gap-1.5 overflow-hidden tv:gap-2">
            <div className="flex shrink-0 items-end justify-between gap-2 px-0.5">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 tv:text-[10px]">
                  {vista === VISTA_TV_TODOS
                    ? t("producao.tv.setores.inicioKicker")
                    : t("producao.tv.setores.etapasDe")}
                </p>
                <h2 className="truncate text-sm font-bold text-white tv:text-base">
                  {vista === VISTA_TV_TODOS
                    ? t("producao.tv.setores.inicioTitulo")
                    : vista}
                </h2>
              </div>
              <p className="font-tv-mono shrink-0 text-xs tabular-nums text-slate-400 tv:text-sm">
                {ordensVista.length} {t("producao.tv.osAtivas")}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <TvKanbanBoard
                ordens={ordensVista}
                colunas={colunas}
                colunaIdPorOrdem={colunaIdPorOrdem}
                permitirArrastar={permitirArrastar}
                carregando={carregando}
                onMoverOrdem={moverOrdem}
                onAbrirSetor={
                  vista === VISTA_TV_TODOS ? setVistaSetor : undefined
                }
              />
            </div>
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
