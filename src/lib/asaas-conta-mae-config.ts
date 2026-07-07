import fs from "node:fs";
import path from "node:path";
import type { AsaasAmbiente, AsaasConfig } from "@/lib/asaas-config";

/** Parser igual ao deploy/ecosystem.config.cjs — lê .env em runtime no VPS. */
function carregarEnvArquivo(): Record<string, string> {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return {};

  const vars: Record<string, string> = {};
  for (const linha of fs.readFileSync(envPath, "utf8").split("\n")) {
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

let cacheEnvArquivo: Record<string, string> | null = null;

function envArquivo(chave: string): string {
  if (!cacheEnvArquivo) cacheEnvArquivo = carregarEnvArquivo();
  return cacheEnvArquivo[chave]?.trim() || "";
}

/**
 * Leitura dinâmica — evita o Next.js “congelar” vazio no `next build`.
 * Se o processo não receber a variável (PM2/build), lê o `.env` do disco.
 */
function envServidor(chave: string): string {
  return process.env[chave]?.trim() || envArquivo(chave);
}

/** Conta-mãe Asaas (BaaS) — cria subcontas para os laboratórios. */
export function obterConfigContaMaeAsaas(): AsaasConfig {
  const apiKey =
    envServidor("ASAAS_CONTA_MAE_API_KEY") ||
    envServidor("ASAAS_PLATAFORMA_API_KEY") ||
    "";
  const ambienteRaw =
    envServidor("ASAAS_CONTA_MAE_AMBIENTE").toLowerCase() ||
    envServidor("ASAAS_PLATAFORMA_AMBIENTE").toLowerCase();
  const ambiente: AsaasAmbiente = ambienteRaw === "producao" ? "producao" : "sandbox";
  const webhookToken =
    envServidor("ASAAS_CONTA_MAE_WEBHOOK_TOKEN") ||
    envServidor("ASAAS_PLATAFORMA_WEBHOOK_TOKEN") ||
    "";
  return { apiKey, ambiente, webhookToken };
}

export function contaMaeAsaasConfigurada(): boolean {
  return Boolean(obterConfigContaMaeAsaas().apiKey);
}
