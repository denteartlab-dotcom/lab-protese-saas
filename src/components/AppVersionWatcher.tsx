"use client";

import { useEffect } from "react";
import { APP_BUILD_ID, isBuildIdProducao } from "@/lib/app-build-id";
import { revalidarArmazenamentoLaboratorio } from "@/lib/armazenamento-laboratorio";

const STORAGE_KEY = "labProteseBuildId";
const INTERVALO_MS = 3 * 60 * 1000;

async function buildIdServidor() {
  const res = await fetch("/api/version", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { buildId?: string };
  return json.buildId?.trim() || null;
}

function recarregarComNovaVersao(novaBuildId: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, novaBuildId);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

export function AppVersionWatcher() {
  useEffect(() => {
    if (!isBuildIdProducao()) return;

    const buildLocal = APP_BUILD_ID;

    try {
      const salvo = sessionStorage.getItem(STORAGE_KEY);
      if (salvo && salvo !== buildLocal) {
        recarregarComNovaVersao(buildLocal);
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, buildLocal);
    } catch {
      /* ignore */
    }

    let verificando = false;

    async function verificar(novaVersaoRecarrega = true) {
      if (verificando) return;
      verificando = true;
      try {
        const remoto = await buildIdServidor();
        if (!remoto) return;

        if (remoto !== buildLocal) {
          if (novaVersaoRecarrega) {
            recarregarComNovaVersao(remoto);
          }
          return;
        }

        await revalidarArmazenamentoLaboratorio();
      } catch {
        /* offline */
      } finally {
        verificando = false;
      }
    }

    const onVisibilidade = () => {
      if (document.visibilityState === "visible") {
        void verificar(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibilidade);
    const intervalo = window.setInterval(() => void verificar(true), INTERVALO_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilidade);
      window.clearInterval(intervalo);
    };
  }, []);

  return null;
}
