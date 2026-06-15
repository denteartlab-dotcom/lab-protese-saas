import { montarUrlPublica } from "@/lib/app-url";
import { buscarJsonStorePublicoPorToken } from "@/lib/json-store-tenant";
import { garantirUrlPublicaAbsoluta } from "@/lib/whatsapp";

export type ExtratoPublicaRegistro = {
  base64: string;
  nomeArquivo: string;
  titulo: string;
  clienteNome: string;
  criadoEm: string;
  expiraEm: string;
};

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

export function extratoPublicaPdfUrl(token: string) {
  return montarUrlPublica(`/api/financeiro/extrato-publica/${token}`);
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

export function mensagemWhatsappExtratoConferencia(input: {
  clienteNome: string;
  publicUrl: string;
}) {
  return `Extrato Financeiro — ${input.clienteNome}\nSolicito o extrato para conferência.\n\n${input.publicUrl}`;
}

export async function publicarExtratoPublica(input: {
  blob: Blob;
  clienteNome: string;
  nomeArquivo: string;
  titulo: string;
}) {
  const { blobParaBase64 } = await import("@/lib/pdf-viewer-aba");
  const base64 = await blobParaBase64(input.blob);
  const res = await fetch("/api/financeiro/extrato-publica", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base64,
      clienteNome: input.clienteNome,
      nomeArquivo: input.nomeArquivo,
      titulo: input.titulo,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    token?: string;
    url?: string;
    error?: string;
  };
  if (!res.ok || !json.url) {
    throw new Error(json.error || "Não foi possível publicar o extrato.");
  }
  return garantirUrlPublicaAbsoluta(json.url);
}
