import { agendarNotificacaoTvOrdens, agendarNotificacaoTvOrdensVarios } from "@/lib/tv-notify-debounce";
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

/** Agenda refresh debounced da TV (issue 004). */
export function notificarTvOrdensEmpresa(empresaId: string, trabalhoId?: string) {
  agendarNotificacaoTvOrdens(empresaId, trabalhoId);
}

/** Vários trabalhos em um único debounce (issue 008). */
export function notificarTvOrdensEmpresaVarios(empresaId: string, trabalhoIds: string[]) {
  if (trabalhoIds.length === 0) {
    agendarNotificacaoTvOrdens(empresaId);
    return;
  }
  agendarNotificacaoTvOrdensVarios(empresaId, trabalhoIds);
}
