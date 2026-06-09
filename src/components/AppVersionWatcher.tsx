"use client";

import { useEffect } from "react";
import { APP_BUILD_ID, isBuildIdProducao } from "@/lib/app-build-id";
import { armazenamentoLaboratorioPronto, revalidarArmazenamentoLaboratorio } from "@/lib/armazenamento-laboratorio";

const STORAGE_KEY = "labProteseBuildId";
const STORAGE_RELOAD_AT = "labProteseReloadAt";
const INTERVALO_MS = 3 * 60 * 1000;
const COOLDOWN_RECARGA_MS = 30_000;

async function buildIdServidor() {
  const res = await fetch("/api/version", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { buildId?: string };
  return json.buildId?.trim() || null;
}

function podeRecarregarAgora() {
  try {
    const ultima = Number(sessionStorage.getItem(STORAGE_RELOAD_AT) || "0");
    return Date.now() - ultima > COOLDOWN_RECARGA_MS;
  } catch {
    return true;
  }
}

function recarregarComNovaVersao(novaBuildId: string) {
  if (!podeRecarregarAgora()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, novaBuildId);
    sessionStorage.setItem(STORAGE_RELOAD_AT, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.location.reload();
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
        if (!remoto) return;

        if (remoto !== APP_BUILD_ID) {
          recarregarComNovaVersao(remoto);
          return;
        }

        try {
          sessionStorage.setItem(STORAGE_KEY, remoto);
        } catch {
          /* ignore */
        }

        if (armazenamentoLaboratorioPronto()) {
          await revalidarArmazenamentoLaboratorio();
        }
      } catch {
        /* offline */
      } finally {
        verificando = false;
      }
    }

    function iniciarMonitoramento() {
      void verificar();
      intervalo = window.setInterval(() => void verificar(), INTERVALO_MS);
    }

    const onVisibilidade = () => {
      if (document.visibilityState === "visible") {
        void verificar();
      }
    };

    document.addEventListener("visibilitychange", onVisibilidade);
    iniciarMonitoramento();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilidade);
      if (intervalo) window.clearInterval(intervalo);
    };
  }, []);

  return null;
}
