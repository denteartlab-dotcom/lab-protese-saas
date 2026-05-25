export const ASAAS_CONFIG_KEY = "asaasIntegracao";

export type AsaasAmbiente = "sandbox" | "producao";

export type AsaasConfig = {
  apiKey: string;
  ambiente: AsaasAmbiente;
  webhookToken: string;
};

export const ASAAS_CONFIG_PADRAO: AsaasConfig = {
  apiKey: "",
  ambiente: "sandbox",
  webhookToken: "",
};

export function asaasConfigurado(config: AsaasConfig): boolean {
  return Boolean(config.apiKey?.trim());
}

export function urlBaseAsaas(ambiente: AsaasAmbiente): string {
  return ambiente === "producao"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}
