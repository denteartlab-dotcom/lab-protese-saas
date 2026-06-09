"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PrioridadeOs } from "@/components/modulo-tv/types";

type FiltroPrioridade = PrioridadeOs | "todas";

type TvDashboardState = {
  filtroColaborador: string | null;
  filtroPrioridade: FiltroPrioridade;
  sonsAtivos: boolean;
  modoKiosk: boolean;
  fullscreenAuto: boolean;
  novasOsIds: string[];
  wsConectado: boolean;
  setFiltroColaborador: (id: string | null) => void;
  setFiltroPrioridade: (p: FiltroPrioridade) => void;
  setSonsAtivos: (v: boolean) => void;
  setModoKiosk: (v: boolean) => void;
  setFullscreenAuto: (v: boolean) => void;
  setWsConectado: (v: boolean) => void;
  marcarOsNova: (id: string) => void;
  removerOsNova: (id: string) => void;
  initKioskFromUrl: () => void;
};

export const useTvDashboardStore = create<TvDashboardState>()(
  persist(
    (set, get) => ({
      filtroColaborador: null,
      filtroPrioridade: "todas",
      sonsAtivos: false,
      modoKiosk: false,
      fullscreenAuto: true,
      novasOsIds: [],
      wsConectado: false,

      setFiltroColaborador: (id) => set({ filtroColaborador: id }),
      setFiltroPrioridade: (p) => set({ filtroPrioridade: p }),
      setSonsAtivos: (v) => set({ sonsAtivos: v }),
      setModoKiosk: (v) => set({ modoKiosk: v }),
      setFullscreenAuto: (v) => set({ fullscreenAuto: v }),
      setWsConectado: (v) => set({ wsConectado: v }),

      marcarOsNova: (id) => {
        if (get().novasOsIds.includes(id)) return;
        set({ novasOsIds: [...get().novasOsIds, id] });
        window.setTimeout(() => get().removerOsNova(id), 8000);
      },

      removerOsNova: (id) =>
        set({ novasOsIds: get().novasOsIds.filter((x) => x !== id) }),

      initKioskFromUrl: () => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("kiosk") === "1") {
          set({ modoKiosk: true, fullscreenAuto: true, sonsAtivos: true });
        }
      },
    }),
    {
      name: "tv-dashboard-prefs",
      partialize: (s) => ({
        sonsAtivos: s.sonsAtivos,
        modoKiosk: s.modoKiosk,
        fullscreenAuto: s.fullscreenAuto,
        filtroColaborador: s.filtroColaborador,
        filtroPrioridade: s.filtroPrioridade,
      }),
    }
  )
);
