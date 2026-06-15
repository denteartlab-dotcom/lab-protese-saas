import type { AsaasAmbiente, AsaasConfig } from "@/lib/asaas-config";

export function obterConfigAsaasPlataforma(): AsaasConfig {
  const apiKey = process.env.ASAAS_PLATAFORMA_API_KEY?.trim() || "";
  const ambienteRaw = process.env.ASAAS_PLATAFORMA_AMBIENTE?.trim().toLowerCase();
  const ambiente: AsaasAmbiente = ambienteRaw === "producao" ? "producao" : "sandbox";
  const webhookToken = process.env.ASAAS_PLATAFORMA_WEBHOOK_TOKEN?.trim() || "";
  return { apiKey, ambiente, webhookToken };
}

export function asaasPlataformaConfigurado(): boolean {
  return Boolean(obterConfigAsaasPlataforma().apiKey);
}
