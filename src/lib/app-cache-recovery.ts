import { normalizarBuildId } from "@/lib/app-build-id";

/** Limpa caches do navegador e service workers (uso após deploy). */
export async function limparCachesAplicacao(): Promise<void> {
  const passos: Promise<unknown>[] = [];

  if (typeof window !== "undefined" && window.caches?.keys) {
    passos.push(
      window.caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    );
  }

  if (typeof navigator !== "undefined" && navigator.serviceWorker?.getRegistrations) {
    passos.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
    );
  }

  await Promise.all(passos);
}

export const RECARGA_CACHE_KEY = "labChunkReloadAt";
export const RECARGA_CACHE_TENTATIVAS_KEY = "labChunkReloadTentativas";
export const BUILD_SINCRONIZADO_KEY = "labBuildSincronizado";

export function recargaCacheRecente(ms = 4000): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ultima = Number(sessionStorage.getItem(RECARGA_CACHE_KEY) || "0");
    return Date.now() - ultima < ms;
  } catch {
    return false;
  }
}

/** Recarrega com parâmetros que forçam HTML/JS novos (sem aba anônima). */
export function recarregarAplicacaoSemCache(buildId?: string): void {
  if (typeof window === "undefined") return;
  const build = normalizarBuildId(buildId, "");
  try {
    sessionStorage.setItem(RECARGA_CACHE_KEY, String(Date.now()));
    if (build) sessionStorage.setItem(BUILD_SINCRONIZADO_KEY, build);
  } catch {
    /* ignore */
  }

  const url = new URL(window.location.href);
  ["_cb", "_fresh", "_build"].forEach((nome) => url.searchParams.delete(nome));
  if (build) url.searchParams.set("_build", build);
  url.searchParams.set("_cb", String(Date.now()));
  window.location.replace(url.toString());
}
