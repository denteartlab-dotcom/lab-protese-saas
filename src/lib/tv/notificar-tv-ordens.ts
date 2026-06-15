import { getTvOrdensStore } from "@/lib/tv/tv-ordens-store";

async function refreshStore(empresaId: string) {
  const store = getTvOrdensStore(empresaId);
  await store.refreshFromDb();
  store.syncBroadcast();
}

/** Atualiza o snapshot da TV e emite eventos Socket.IO para clientes conectados. */
export async function notificarTvOrdensAtualizadas() {
  try {
    const globalForTv = globalThis as typeof globalThis & {
      __tvOrdensStores?: Map<string, ReturnType<typeof getTvOrdensStore>>;
    };
    const stores = globalForTv.__tvOrdensStores;
    if (!stores?.size) return;
    await Promise.all([...stores.keys()].map((empresaId) => refreshStore(empresaId)));
  } catch (erro) {
    console.error("[tv] notificarTvOrdensAtualizadas", erro);
  }
}

export async function notificarTvOrdensEmpresa(empresaId: string) {
  try {
    await refreshStore(empresaId);
  } catch (erro) {
    console.error("[tv] notificarTvOrdensEmpresa", erro);
  }
}
