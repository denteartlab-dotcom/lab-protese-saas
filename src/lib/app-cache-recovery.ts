/** Limpa caches do navegador e service workers (página /limpar-sessao). */
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
