/** Preferências leves em cookie (1 ano) para hidratar filtros sem reler o storage. */

export const APP_PREFS_COOKIE = "lab_prefs";

export type AppPreferenciasCookie = {
  fluxoSituacao?: "previsto" | "realizado";
  fluxoPeriodo?: string;
};

function lerCookieRaw(): string | null {
  if (typeof document === "undefined") return null;
  const parte = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${APP_PREFS_COOKIE}=`));
  if (!parte) return null;
  return decodeURIComponent(parte.slice(APP_PREFS_COOKIE.length + 1));
}

export function lerPreferenciasCookie(): AppPreferenciasCookie {
  try {
    const raw = lerCookieRaw();
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AppPreferenciasCookie;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function salvarPreferenciasCookie(patch: AppPreferenciasCookie) {
  if (typeof document === "undefined") return;
  const atual = lerPreferenciasCookie();
  const merged = { ...atual, ...patch };
  const valor = encodeURIComponent(JSON.stringify(merged));
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${APP_PREFS_COOKIE}=${valor};path=/;max-age=${maxAge};SameSite=Lax`;
}
