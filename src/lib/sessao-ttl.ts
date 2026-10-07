/**
 * Tempo máximo sem renovação da sessão.
 * O cookie JWT expira sozinho — vale mesmo com o site fechado.
 */
export const SESSAO_INATIVIDADE_S = 2 * 60 * 60;
export const SESSAO_INATIVIDADE_MS = SESSAO_INATIVIDADE_S * 1000;

/** Cookie e JWT do laboratório: mesmo prazo da inatividade (desliza com o uso). */
export function ttlCookieSessaoLabSegundos(_remember?: boolean) {
  return SESSAO_INATIVIDADE_S;
}

/** true se o `iat` do JWT passou do limite de inatividade. */
export function sessaoInativaPorIat(
  iat: number | undefined,
  agoraMs = Date.now(),
  limiteS = SESSAO_INATIVIDADE_S
) {
  if (typeof iat !== "number" || !Number.isFinite(iat) || iat <= 0) return false;
  return agoraMs / 1000 - iat > limiteS;
}
