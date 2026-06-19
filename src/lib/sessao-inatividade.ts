/** Logout automático após 2 horas sem interação na aba atual. */
export const SESSAO_INATIVIDADE_MS = 2 * 60 * 60 * 1000;

export const SESSAO_ULTIMA_ATIVIDADE_KEY = "labProteseUltimaAtividade";

function storageAtividade() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function registrarAtividadeSessao() {
  const storage = storageAtividade();
  if (!storage) return;
  try {
    storage.setItem(SESSAO_ULTIMA_ATIVIDADE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function lerUltimaAtividadeSessao(): number | null {
  const storage = storageAtividade();
  if (!storage) return null;
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
  const ultima = lerUltimaAtividadeSessao();
  if (ultima == null) return false;
  return agora - ultima > SESSAO_INATIVIDADE_MS;
}

export function limparUltimaAtividadeSessao() {
  const storage = storageAtividade();
  if (!storage) return;
  try {
    storage.removeItem(SESSAO_ULTIMA_ATIVIDADE_KEY);
  } catch {
    /* ignore */
  }
}
