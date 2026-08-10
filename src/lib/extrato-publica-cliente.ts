import { montarUrlPublica } from "@/lib/app-url";
import { garantirUrlPublicaAbsoluta } from "@/lib/whatsapp";

export type ExtratoPublicaRegistro = {
  base64: string;
  nomeArquivo: string;
  titulo: string;
  clienteNome: string;
  criadoEm: string;
  expiraEm: string;
};

export function mensagemWhatsappExtratoConferencia(input: {
  clienteNome: string;
  publicUrl: string;
}) {
  return `Extrato Financeiro — ${input.clienteNome}\nSegue o PDF do extrato para conferência.\n\n${input.publicUrl}`;
}

export async function publicarExtratoPublica(input: {
  blob: Blob;
  clienteNome: string;
  nomeArquivo: string;
  titulo: string;
}) {
  const { blobParaBase64 } = await import("@/lib/blob-base64");
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
    pdfUrl?: string;
    error?: string;
  };
  if (!res.ok || !(json.pdfUrl || json.url)) {
    throw new Error(json.error || "Não foi possível publicar o extrato.");
  }
  const pdfUrl = garantirUrlPublicaAbsoluta(json.pdfUrl || json.url!);
  const paginaUrl = json.url ? garantirUrlPublicaAbsoluta(json.url) : pdfUrl;
  return {
    token: json.token || "",
    /** Link direto do arquivo PDF (preferencial para WhatsApp). */
    pdfUrl,
    /** Página de visualização (fallback). */
    url: paginaUrl,
  };
}
