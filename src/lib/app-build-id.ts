import { readFileSync } from "fs";
import path from "path";

function lerBuildIdArquivo(): string {
  try {
    const arquivo = path.join(process.cwd(), ".build-id");
    const valor = readFileSync(arquivo, "utf8").trim();
    return valor.length >= 6 ? valor : "";
  } catch {
    return "";
  }
}

function buildIdDeEnv(): string {
  const candidatos = [
    process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim(),
    process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 12),
    process.env.GITHUB_SHA?.trim().slice(0, 12),
  ];
  for (const valor of candidatos) {
    if (valor && valor.length >= 6) return valor;
  }
  return "";
}

/** Identificador da build atual (cliente e API devem usar a mesma origem). */
export const APP_BUILD_ID = lerBuildIdArquivo() || buildIdDeEnv() || "dev";

export function isBuildIdProducao(buildId = APP_BUILD_ID) {
  return buildId !== "dev" && buildId.length >= 6;
}
