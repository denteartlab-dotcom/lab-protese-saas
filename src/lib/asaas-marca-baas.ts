/** Textos e URLs do selo institucional Asaas (BaaS / Res. Conjunta BC 16/17). */

export const ASAAS_RAZAO_SOCIAL =
  "Asaas Gestão Financeira Instituição de Pagamento S.A.";
export const ASAAS_CNPJ = "19.540.550/0001-21";
export const ASAAS_CODIGO_BANCO = "461";
export const ASAAS_SITE_URL = "https://www.asaas.com";
export const ASAAS_TERMOS_URL =
  "https://central.ajuda.asaas.com/hc/pt-br/articles/32096847160859-Termos-e-Condi%C3%A7%C3%B5es-de-Uso";

export type VarianteSeloAsaas = "claro" | "escuro";

export function urlSeloAsaas(variante: VarianteSeloAsaas): string {
  const custom =
    variante === "escuro"
      ? process.env.NEXT_PUBLIC_ASAAS_SELO_ESCURO_URL?.trim()
      : process.env.NEXT_PUBLIC_ASAAS_SELO_CLARO_URL?.trim();
  if (custom) return custom;
  return variante === "escuro" ? "/asaas/selo-negativo.svg" : "/asaas/selo-azul.svg";
}

export function textoInstitucionalAsaasCurto(): string {
  return `${ASAAS_RAZAO_SOCIAL}, CNPJ ${ASAAS_CNPJ}, instituição de pagamento autorizada pelo Banco Central do Brasil (código ${ASAAS_CODIGO_BANCO}).`;
}

export function textoServicosFinanceirosAsaas(): string {
  return (
    "Os serviços financeiros disponíveis nesta plataforma (conta digital, boletos, Pix, " +
    "pagamentos e transferências) são operados pelo Asaas, instituição de pagamento " +
    "autorizada pelo Banco Central do Brasil. A relação financeira e o contrato de " +
    "conta de pagamento são firmados entre o laboratório cliente e o Asaas."
  );
}
