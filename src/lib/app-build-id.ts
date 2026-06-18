/** Identificador da build — seguro para cliente (inlined no bundle via next.config). */
export const APP_BUILD_ID =
  process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 12) ||
  process.env.GITHUB_SHA?.trim().slice(0, 12) ||
  "dev";

export function isBuildIdProducao(buildId = APP_BUILD_ID) {
  return buildId !== "dev" && buildId.length >= 6;
}
