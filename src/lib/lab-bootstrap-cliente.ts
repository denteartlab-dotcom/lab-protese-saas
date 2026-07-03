"use client";

import { apiFetch } from "@/lib/fetch-client";
import type { LabBootstrapPayload } from "@/lib/lab-bootstrap-types";

const TTL_MS = 60_000;

let cache: LabBootstrapPayload | null = null;
let cacheEm = 0;
let inflight: Promise<LabBootstrapPayload> | null = null;

export const LAB_BOOTSTRAP_ATUALIZADO_EVENT = "lab-bootstrap-atualizado";

function cacheValido() {
  return cache !== null && Date.now() - cacheEm < TTL_MS;
}

export function lerLabBootstrapCliente(): LabBootstrapPayload | null {
  return cacheValido() ? cache : null;
}

export function invalidarLabBootstrapCliente() {
  cache = null;
  cacheEm = 0;
  inflight = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LAB_BOOTSTRAP_ATUALIZADO_EVENT));
  }
}

export async function carregarLabBootstrap(forcar = false): Promise<LabBootstrapPayload> {
  if (!forcar && cacheValido() && cache) return cache;
  if (!forcar && inflight) return inflight;

  inflight = apiFetch<{ data: LabBootstrapPayload }>("/api/lab/bootstrap", {
    cache: "default",
  })
    .then((res) => {
      cache = res.data;
      cacheEm = Date.now();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(LAB_BOOTSTRAP_ATUALIZADO_EVENT));
      }
      return res.data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
