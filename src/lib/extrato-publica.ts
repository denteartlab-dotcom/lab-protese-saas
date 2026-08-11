import { montarUrlPublica } from "@/lib/app-url";
import { buscarJsonStorePublicoPorToken } from "@/lib/json-store-tenant";
import { type ExtratoPublicaRegistro } from "@/lib/extrato-publica-cliente";
import {
  normalizarNomeArquivoExtratoPdf,
  segmentoUrlNomeArquivoPdf,
} from "@/lib/extrato-publica-pdf-resposta";

export {
  mensagemWhatsappExtratoConferencia,
  publicarExtratoPublica,
  type ExtratoPublicaRegistro,
} from "@/lib/extrato-publica-cliente";

export const PREFIXO_JSON_STORE_EXTRATO_PUBLICA = "extrato-publica:";
const DIAS_VALIDADE = 30;

export function chaveExtratoPublica(token: string) {
  return `${PREFIXO_JSON_STORE_EXTRATO_PUBLICA}${token}`;
}

export async function buscarRegistroExtratoPublicaPorToken(token: string) {
  return buscarJsonStorePublicoPorToken<ExtratoPublicaRegistro>(
    token,
    PREFIXO_JSON_STORE_EXTRATO_PUBLICA
  );
}

export function criarTokenExtratoPublica() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `ep${Date.now()}${Math.random().toString(36).slice(2, 12)}`;
}

export function extratoPublicaUrl(token: string) {
  return montarUrlPublica(`/extrato/${token}`);
}

export function extratoPublicaPdfUrl(
  token: string,
  nomeArquivo?: string | null,
  clienteNome?: string | null
) {
  const nome = normalizarNomeArquivoExtratoPdf(nomeArquivo, clienteNome);
  return montarUrlPublica(
    `/api/financeiro/extrato-publica/${token}/${segmentoUrlNomeArquivoPdf(nome)}`
  );
}

export function montarRegistroExtratoPublica(input: {
  base64: string;
  nomeArquivo: string;
  titulo: string;
  clienteNome: string;
}): ExtratoPublicaRegistro {
  const criadoEm = new Date();
  const expiraEm = new Date(criadoEm);
  expiraEm.setDate(expiraEm.getDate() + DIAS_VALIDADE);
  return {
    ...input,
    nomeArquivo: normalizarNomeArquivoExtratoPdf(
      input.nomeArquivo,
      input.clienteNome
    ),
    criadoEm: criadoEm.toISOString(),
    expiraEm: expiraEm.toISOString(),
  };
}

export function registroExtratoPublicaValido(
  registro: ExtratoPublicaRegistro | null | undefined
) {
  if (!registro?.base64) return false;
  const expira = new Date(registro.expiraEm);
  if (Number.isNaN(expira.getTime())) return true;
  return expira.getTime() >= Date.now();
}
