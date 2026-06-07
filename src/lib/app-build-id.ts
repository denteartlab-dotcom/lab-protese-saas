/** Identificador da build atual (injetado em `next.config.ts`). */
export const APP_BUILD_ID =
  process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() || "dev";

export function isBuildIdProducao(buildId = APP_BUILD_ID) {
  return buildId !== "dev" && buildId.length > 0;
}
