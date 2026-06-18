import { readFileSync } from "fs";
import path from "path";

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

function lerBuildIdArquivo(): string {
  try {
    const arquivo = path.join(process.cwd(), ".build-id");
    const valor = readFileSync(arquivo, "utf8").trim();
    return valor.length >= 6 ? valor : "";
  } catch {
    return "";
  }
}

/** Build id em rotas/API (lê .build-id gravado no deploy). */
export function obterAppBuildIdServidor(): string {
  const id = lerBuildIdArquivo() || buildIdDeEnv();
  if (id && id.length >= 6) return id;
  return "dev";
}
