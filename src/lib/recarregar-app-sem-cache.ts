/** Limpa caches do navegador (Cache API + service workers). */
export async function limparCachesNavegador(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }

  try {
    if (window.caches) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

/** Recarrega a página ignorando cache HTTP (query única por tentativa). */
export function recarregarAppSemCache(buildId?: string): void {
  const url = new URL(window.location.href);
  if (buildId) url.searchParams.set("_build", buildId);
  url.searchParams.set("_cb", String(Date.now()));
  window.location.replace(url.toString());
}

/** Limpa caches e recarrega — uso após deploy ou chunk quebrado. */
export async function recarregarAppSemCacheCompleto(buildId?: string): Promise<void> {
  await limparCachesNavegador();
  recarregarAppSemCache(buildId);
}
