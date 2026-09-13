/** Logout automático após 2 horas sem interação (persiste se o navegador fechar). */
export const SESSAO_INATIVIDADE_MS = 2 * 60 * 60 * 1000;

export const SESSAO_ULTIMA_ATIVIDADE_KEY = "labProteseUltimaAtividade";

/** Heartbeat do Módulo TV — enquanto fresco, a sessão não cai por inatividade. */
export const SESSAO_TV_ABERTA_KEY = "labProteseTvAberta";

/** TV considerada aberta se o último heartbeat for mais recente que isto. */
export const SESSAO_TV_HEARTBEAT_MAX_MS = 90_000;

function storagePersistente() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function migrarAtividadeDeSessionStorage(destino: Storage) {
  try {
    if (destino.getItem(SESSAO_ULTIMA_ATIVIDADE_KEY)) return;
    const legado = window.sessionStorage.getItem(SESSAO_ULTIMA_ATIVIDADE_KEY);
    if (!legado) return;
    destino.setItem(SESSAO_ULTIMA_ATIVIDADE_KEY, legado);
    window.sessionStorage.removeItem(SESSAO_ULTIMA_ATIVIDADE_KEY);
  } catch {
    /* ignore */
  }
}

export function registrarAtividadeSessao() {
  const storage = storagePersistente();
  if (!storage) return;
  try {
    storage.setItem(SESSAO_ULTIMA_ATIVIDADE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function lerUltimaAtividadeSessao(): number | null {
  const storage = storagePersistente();
  if (!storage) return null;
  migrarAtividadeDeSessionStorage(storage);
  try {
    const raw = storage.getItem(SESSAO_ULTIMA_ATIVIDADE_KEY);
    if (!raw) return null;
    const valor = Number(raw);
    return Number.isFinite(valor) ? valor : null;
  } catch {
    return null;
  }
}

export function sessaoExpiradaPorInatividade(agora = Date.now()): boolean {
  if (moduloTvAbertoRecentemente(agora)) return false;
  const ultima = lerUltimaAtividadeSessao();
  if (ultima == null) return false;
  return agora - ultima > SESSAO_INATIVIDADE_MS;
}

export function limparUltimaAtividadeSessao() {
  const storage = storagePersistente();
  if (!storage) return;
  try {
    storage.removeItem(SESSAO_ULTIMA_ATIVIDADE_KEY);
    storage.removeItem(SESSAO_TV_ABERTA_KEY);
  } catch {
    /* ignore */
  }
}

type HeartbeatTv = { tabId: string; ts: number };

function lerHeartbeatTv(): HeartbeatTv | null {
  const storage = storagePersistente();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSAO_TV_ABERTA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HeartbeatTv>;
    if (
      typeof parsed.tabId !== "string" ||
      typeof parsed.ts !== "number" ||
      !Number.isFinite(parsed.ts)
    ) {
      return null;
    }
    return { tabId: parsed.tabId, ts: parsed.ts };
  } catch {
    return null;
  }
}

export function moduloTvAbertoRecentemente(agora = Date.now()): boolean {
  const hb = lerHeartbeatTv();
  if (!hb) return false;
  return agora - hb.ts <= SESSAO_TV_HEARTBEAT_MAX_MS;
}

/** Mantém o Módulo TV “aberto” para outras abas não derrubarem a sessão. */
export function registrarModuloTvAberto(tabId: string) {
  const storage = storagePersistente();
  if (!storage || !tabId) return;
  try {
    const payload: HeartbeatTv = { tabId, ts: Date.now() };
    storage.setItem(SESSAO_TV_ABERTA_KEY, JSON.stringify(payload));
    // Enquanto a TV estiver aberta, a inatividade não conta contra a conta.
    storage.setItem(SESSAO_ULTIMA_ATIVIDADE_KEY, String(payload.ts));
  } catch {
    /* ignore */
  }
}

/** Remove o heartbeat só se esta aba for a dona do sinal. */
export function limparModuloTvAberto(tabId: string) {
  const storage = storagePersistente();
  if (!storage || !tabId) return;
  try {
    const hb = lerHeartbeatTv();
    if (hb && hb.tabId !== tabId) return;
    storage.removeItem(SESSAO_TV_ABERTA_KEY);
  } catch {
    /* ignore */
  }
}
