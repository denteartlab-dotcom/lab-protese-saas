/** Logout automático após 3 horas sem interação no sistema (/app). */
export const SESSAO_INATIVIDADE_MS = 3 * 60 * 60 * 1000;

export const SESSAO_ULTIMA_ATIVIDADE_KEY = "labProteseUltimaAtividade";

export function registrarAtividadeSessao() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSAO_ULTIMA_ATIVIDADE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function lerUltimaAtividadeSessao(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSAO_ULTIMA_ATIVIDADE_KEY);
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
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSAO_ULTIMA_ATIVIDADE_KEY);
  } catch {
    /* ignore */
  }
}
