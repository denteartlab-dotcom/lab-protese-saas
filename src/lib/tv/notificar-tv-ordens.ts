import { getTvOrdensStore } from "@/lib/tv/tv-ordens-store";

/** Atualiza o snapshot da TV e emite eventos Socket.IO para clientes conectados. */
export async function notificarTvOrdensAtualizadas() {
  try {
    const store = getTvOrdensStore();
    await store.refreshFromDb();
    store.syncBroadcast();
  } catch (erro) {
    console.error("[tv] notificarTvOrdensAtualizadas", erro);
  }
}
