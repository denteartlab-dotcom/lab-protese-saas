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

export type ExtratoPublicaPublicado = {
  token: string;
  pdfUrl: string;
  url: string;
};

export async function publicarExtratoPublica(input: {
  blob: Blob;
  clienteNome: string;
  nomeArquivo: string;
  titulo: string;
}): Promise<ExtratoPublicaPublicado> {
  const form = new FormData();
  form.append(
    "file",
    new File([input.blob], input.nomeArquivo, {
      type: input.blob.type || "application/pdf",
    })
  );
  form.append("clienteNome", input.clienteNome);
  form.append("nomeArquivo", input.nomeArquivo);
  form.append("titulo", input.titulo);

  const res = await fetch("/api/financeiro/extrato-publica", {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });

  const json = (await res.json().catch(() => ({}))) as {
    token?: string;
    url?: string;
    pdfUrl?: string;
    error?: string;
  };

  if (!res.ok || !(json.pdfUrl || json.url)) {
    throw new Error(
      json.error ||
        `Não foi possível publicar o extrato (HTTP ${res.status}).`
    );
  }

  const pdfUrl = garantirUrlPublicaAbsoluta(json.pdfUrl || json.url!);
  const paginaUrl = json.url ? garantirUrlPublicaAbsoluta(json.url) : pdfUrl;
  return {
    token: json.token || "",
    pdfUrl,
    url: paginaUrl,
  };
}

/** Mantém import usado em páginas públicas / helpers. */
export function extratoPublicaPaginaUrl(token: string) {
  return montarUrlPublica(`/extrato/${token}`);
}
