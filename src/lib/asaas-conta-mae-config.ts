import type { AsaasAmbiente, AsaasConfig } from "@/lib/asaas-config";

/** Conta-mãe Asaas (BaaS) — cria subcontas para os laboratórios. */
export function obterConfigContaMaeAsaas(): AsaasConfig {
  const apiKey =
    process.env.ASAAS_CONTA_MAE_API_KEY?.trim() ||
    process.env.ASAAS_PLATAFORMA_API_KEY?.trim() ||
    "";
  const ambienteRaw =
    process.env.ASAAS_CONTA_MAE_AMBIENTE?.trim().toLowerCase() ||
    process.env.ASAAS_PLATAFORMA_AMBIENTE?.trim().toLowerCase();
  const ambiente: AsaasAmbiente = ambienteRaw === "producao" ? "producao" : "sandbox";
  const webhookToken =
    process.env.ASAAS_CONTA_MAE_WEBHOOK_TOKEN?.trim() ||
    process.env.ASAAS_PLATAFORMA_WEBHOOK_TOKEN?.trim() ||
    "";
  return { apiKey, ambiente, webhookToken };
}

export function contaMaeAsaasConfigurada(): boolean {
  return Boolean(obterConfigContaMaeAsaas().apiKey);
}
