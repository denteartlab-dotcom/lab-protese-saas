import { getTvOrdensStore } from "@/lib/tv/tv-ordens-store";

/** Janela de agrupamento de notificações TV (issue 004). */
const DEBOUNCE_MS = 1_500;

type FilaEmpresa = {
  ids: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
  flushing: boolean;
};

const globalForTvDebounce = globalThis as typeof globalThis & {
  __tvNotifyFilas?: Map<string, FilaEmpresa>;
};

function filasPorEmpresa(): Map<string, FilaEmpresa> {
  if (!globalForTvDebounce.__tvNotifyFilas) {
    globalForTvDebounce.__tvNotifyFilas = new Map();
  }
  return globalForTvDebounce.__tvNotifyFilas;
}

function obterFila(empresaId: string): FilaEmpresa {
  const filas = filasPorEmpresa();
  let fila = filas.get(empresaId);
  if (!fila) {
    fila = { ids: new Set(), timer: null, flushing: false };
    filas.set(empresaId, fila);
  }
  return fila;
}

async function flushNotificacaoTvEmpresa(empresaId: string) {
  const fila = obterFila(empresaId);
  if (fila.flushing) return;

  fila.flushing = true;
  const ids = [...fila.ids];
  fila.ids.clear();
  if (fila.timer) {
    clearTimeout(fila.timer);
    fila.timer = null;
  }

  try {
    const store = getTvOrdensStore(empresaId);
    await store.refreshFromDb();
    if (ids.length === 0) {
      store.syncBroadcast();
    } else {
      store.syncDeltaBroadcast(ids);
    }
  } catch (erro) {
    console.error("[tv-notify-debounce] flush", empresaId, erro);
  } finally {
    fila.flushing = false;
    if (fila.ids.size > 0) {
      fila.timer = setTimeout(() => {
        void flushNotificacaoTvEmpresa(empresaId);
      }, DEBOUNCE_MS);
    }
  }
}

/** Agrupa notificações por empresa; emite no máximo 1 refresh por janela. */
export function agendarNotificacaoTvOrdens(empresaId: string, trabalhoId?: string) {
  const fila = obterFila(empresaId);
  if (trabalhoId) fila.ids.add(trabalhoId);

  if (fila.timer) clearTimeout(fila.timer);
  fila.timer = setTimeout(() => {
    void flushNotificacaoTvEmpresa(empresaId);
  }, DEBOUNCE_MS);
}

/** Vários IDs em uma única janela de debounce (issue 008). */
export function agendarNotificacaoTvOrdensVarios(empresaId: string, trabalhoIds: Iterable<string>) {
  const fila = obterFila(empresaId);
  for (const id of trabalhoIds) {
    if (id) fila.ids.add(id);
  }

  if (fila.timer) clearTimeout(fila.timer);
  fila.timer = setTimeout(() => {
    void flushNotificacaoTvEmpresa(empresaId);
  }, DEBOUNCE_MS);
}

/** Força flush imediato (ex.: testes ou refresh manual). */
export async function flushNotificacaoTvOrdens(empresaId: string) {
  await flushNotificacaoTvEmpresa(empresaId);
}
