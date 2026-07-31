/**
 * Lê `.env` do disco em runtime (última ocorrência vence).
 * Necessário na VPS: PM2 às vezes não relê o .env e o Next pode
 * não injetar ONEDRIVE_* / UPLOAD_STORAGE corretamente.
 */
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

let cache: Record<string, string> | null = null;
let cacheMtimeMs = 0;

function caminhoEnv() {
  return path.join(process.cwd(), ".env");
}

function parseEnvArquivo(conteudo: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const linha of conteudo.split(/\r?\n/)) {
    const trimmed = linha.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const igual = trimmed.indexOf("=");
    if (igual === -1) continue;
    const chave = trimmed.slice(0, igual).trim();
    let valor = trimmed.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (chave) vars[chave] = valor;
  }
  return vars;
}

/** Recarrega se o .env mudou (mtime). */
export function carregarEnvArquivoRuntime(forcar = false): Record<string, string> {
  const envPath = caminhoEnv();
  let mtimeMs = 0;
  try {
    if (existsSync(envPath)) mtimeMs = statSync(envPath).mtimeMs;
  } catch {
    mtimeMs = 0;
  }

  if (!forcar && cache && cacheMtimeMs === mtimeMs) return cache;

  const fromFile = existsSync(envPath)
    ? parseEnvArquivo(readFileSync(envPath, "utf8"))
    : {};

  // process.env primeiro; arquivo .env sobrescreve (última linha do arquivo vence).
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") merged[k] = v;
  }
  for (const [k, v] of Object.entries(fromFile)) {
    merged[k] = v;
    process.env[k] = v;
  }

  cache = merged;
  cacheMtimeMs = mtimeMs;
  return merged;
}

export function envRuntime(nome: string): string {
  const vars = carregarEnvArquivoRuntime();
  return (vars[nome] || "").trim();
}

/** Invalida cache (após correção do .env sem reiniciar). */
export function limparCacheEnvRuntime() {
  cache = null;
  cacheMtimeMs = 0;
}
