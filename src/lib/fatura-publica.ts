import { garantirUrlPublicaAbsoluta, orcamentoPublicBaseUrl } from "@/lib/whatsapp";

export type FaturaPublicaRegistro = {
  base64: string;
  nomeArquivo: string;
  titulo: string;
  numeroFatura: number;
  clienteNome: string;
  criadoEm: string;
  expiraEm: string;
};

const PREFIXO_JSON_STORE = "fatura-publica:";
const DIAS_VALIDADE = 30;

export function chaveFaturaPublica(token: string) {
  return `${PREFIXO_JSON_STORE}${token}`;
}

export function criarTokenFaturaPublica() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `fp${Date.now()}${Math.random().toString(36).slice(2, 12)}`;
}

export function faturaPublicaUrl(token: string, origin?: string) {
  const base = orcamentoPublicBaseUrl(origin);
  return `${base}/fatura/${token}`;
}

export function faturaPublicaPdfUrl(token: string, origin?: string) {
  const base = orcamentoPublicBaseUrl(origin);
  return `${base}/api/financeiro/fatura-publica/${token}`;
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

export function registroFaturaPublicaValido(
  registro: FaturaPublicaRegistro | null | undefined
) {
  if (!registro?.base64) return false;
  const expira = new Date(registro.expiraEm);
  if (Number.isNaN(expira.getTime())) return true;
  return expira.getTime() >= Date.now();
}

export function mensagemWhatsappFaturaConferencia(input: {
  numeroFatura: number;
  clienteNome: string;
  valorFormatado?: string;
  publicUrl: string;
}) {
  const linhas = [
    `Fatura ${input.numeroFatura} — ${input.clienteNome}`,
    input.valorFormatado ? `Valor: R$ ${input.valorFormatado}` : "",
    "Solicito a fatura para conferência.",
  ].filter(Boolean);
  return `${linhas.join("\n")}\n\n${input.publicUrl}`;
}

export async function publicarFaturaPublica(input: {
  blob: Blob;
  numeroFatura: number;
  clienteNome: string;
  nomeArquivo: string;
  titulo: string;
}) {
  const { blobParaBase64 } = await import("@/lib/pdf-viewer-aba");
  const base64 = await blobParaBase64(input.blob);
  const res = await fetch("/api/financeiro/fatura-publica", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base64,
      numeroFatura: input.numeroFatura,
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
    throw new Error(json.error || "Não foi possível publicar a fatura.");
  }
  return garantirUrlPublicaAbsoluta(json.url);
}
