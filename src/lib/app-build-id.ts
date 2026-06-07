/** Identificador da build atual (cliente e API devem usar a mesma origem). */
export const APP_BUILD_ID =
  process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 12) ||
  "dev";

export function isBuildIdProducao(buildId = APP_BUILD_ID) {
  return buildId !== "dev" && buildId.length > 0;
}
