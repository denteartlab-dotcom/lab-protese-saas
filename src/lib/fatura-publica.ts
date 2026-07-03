import { buscarJsonStorePublicoPorToken } from "@/lib/json-store-tenant";
import {
  PREFIXO_JSON_STORE_FATURA_PUBLICA,
  type FaturaPublicaRegistro,
} from "@/lib/fatura-publica-cliente";

export {
  faturaPublicaPdfUrl,
  faturaPublicaUrl,
  mensagemWhatsappFaturaConferencia,
  PREFIXO_JSON_STORE_FATURA_PUBLICA,
  publicarFaturaPublica,
  registroFaturaPublicaValido,
  type FaturaPublicaRegistro,
} from "@/lib/fatura-publica-cliente";

const DIAS_VALIDADE = 30;

export function chaveFaturaPublica(token: string) {
  return `${PREFIXO_JSON_STORE_FATURA_PUBLICA}${token}`;
}

export async function buscarRegistroFaturaPublicaPorToken(token: string) {
  return buscarJsonStorePublicoPorToken<FaturaPublicaRegistro>(
    token,
    PREFIXO_JSON_STORE_FATURA_PUBLICA
  );
}

export function criarTokenFaturaPublica() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `fp${Date.now()}${Math.random().toString(36).slice(2, 12)}`;
}

export function montarRegistroFaturaPublica(input: {
  base64: string;
  nomeArquivo: string;
  titulo: string;
  numeroFatura: number;
  clienteNome: string;
}): FaturaPublicaRegistro {
  const criadoEm = new Date();
  const expiraEm = new Date(criadoEm);
  expiraEm.setDate(expiraEm.getDate() + DIAS_VALIDADE);
  return {
    ...input,
    criadoEm: criadoEm.toISOString(),
    expiraEm: expiraEm.toISOString(),
  };
}
