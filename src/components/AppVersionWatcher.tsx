"use client";

import { useEffect } from "react";
import { APP_BUILD_ID, isBuildIdProducao } from "@/lib/app-build-id";
import { recarregarAppSemCacheCompleto } from "@/lib/recarregar-app-sem-cache";

const INTERVALO_MS = 5 * 60 * 1000;

async function buildIdServidor() {
  const res = await fetch("/api/version", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { buildId?: string };
  return json.buildId?.trim() || null;
}

export function AppVersionWatcher() {
  useEffect(() => {
    if (!isBuildIdProducao()) return;

    let intervalo: number | null = null;
    let verificando = false;

    async function verificar() {
      if (verificando) return;
      verificando = true;
      try {
        const remoto = await buildIdServidor();
        if (!remoto || remoto === APP_BUILD_ID) return;
        await recarregarAppSemCacheCompleto(remoto);
      } catch {
        /* offline */
      } finally {
        verificando = false;
      }
    }

    void verificar();
    intervalo = window.setInterval(() => void verificar(), INTERVALO_MS);

    const onVisibilidade = () => {
      if (document.visibilityState === "visible") {
        void verificar();
      }
    };

    document.addEventListener("visibilitychange", onVisibilidade);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilidade);
      if (intervalo) window.clearInterval(intervalo);
    };
  }, []);

  return null;
}
