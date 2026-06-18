/** Identificador da build — seguro para cliente (inlined no bundle via next.config). */
export const APP_BUILD_ID =
  process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 12) ||
  process.env.GITHUB_SHA?.trim().slice(0, 12) ||
  "dev";

/** Aceita só hash de commit válido (ignora valores inválidos como "2"). */
export function normalizarBuildId(valor?: string | null, fallback = "dev"): string {
  const v = valor?.trim();
  if (v && v !== "dev" && v.length >= 6) return v;
  return fallback;
}

/** Versão atual da página (meta atualizada a cada request no servidor). */
export function obterBuildIdDoDocumento(fallback = APP_BUILD_ID): string {
  if (typeof document === "undefined") {
    return normalizarBuildId(APP_BUILD_ID, fallback);
  }
  const meta = document.querySelector('meta[name="app-build-id"]');
  const valor = meta?.getAttribute("content");
  return normalizarBuildId(valor, normalizarBuildId(APP_BUILD_ID, fallback));
}

export function isBuildIdProducao(buildId?: string): boolean {
  const id = normalizarBuildId(buildId ?? obterBuildIdDoDocumento(), "dev");
  return id !== "dev";
}
