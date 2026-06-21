/**
 * Preferências leves da interface — persistidas no PostgreSQL (JsonStore),
 * não em cookie nem localStorage. Limpar cache do navegador não apaga filtros salvos.
 */
import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const PREFS_UI_STORAGE_KEY = "labProtesePrefsUi";

/** @deprecated Use PREFS_UI_STORAGE_KEY */
export const APP_PREFS_COOKIE = "lab_prefs";

export type AppPreferenciasUi = {
  fluxoSituacao?: "previsto" | "realizado";
  fluxoPeriodo?: string;
};

/** @deprecated Use AppPreferenciasUi */
export type AppPreferenciasCookie = AppPreferenciasUi;

function lerCookieLegado(): AppPreferenciasUi {
  if (typeof document === "undefined") return {};
  try {
    const parte = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${APP_PREFS_COOKIE}=`));
    if (!parte) return {};
    const raw = decodeURIComponent(parte.slice(APP_PREFS_COOKIE.length + 1));
    const parsed = JSON.parse(raw) as AppPreferenciasUi;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function limparCookieLegado() {
  if (typeof document === "undefined") return;
  document.cookie = `${APP_PREFS_COOKIE}=;path=/;max-age=0;SameSite=Lax`;
}

export function lerPreferenciasUi(): AppPreferenciasUi {
  const doServidor = readStorage<AppPreferenciasUi>(PREFS_UI_STORAGE_KEY, {});
  if (doServidor && Object.keys(doServidor).length > 0) return doServidor;

  const legado = lerCookieLegado();
  if (Object.keys(legado).length > 0) {
    writeStorage(PREFS_UI_STORAGE_KEY, legado);
    limparCookieLegado();
    return legado;
  }

  return {};
}

export function salvarPreferenciasUi(patch: AppPreferenciasUi) {
  if (typeof window === "undefined") return;
  const merged = { ...lerPreferenciasUi(), ...patch };
  writeStorage(PREFS_UI_STORAGE_KEY, merged);
  limparCookieLegado();
}

/** @deprecated Use lerPreferenciasUi */
export function lerPreferenciasCookie(): AppPreferenciasCookie {
  return lerPreferenciasUi();
}

/** @deprecated Use salvarPreferenciasUi */
export function salvarPreferenciasCookie(patch: AppPreferenciasCookie) {
  salvarPreferenciasUi(patch);
}
