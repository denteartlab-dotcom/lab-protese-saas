import { randomBytes } from "node:crypto";

type PdfDocumentoTemp = {
  buffer: Buffer;
  nome: string;
  expira: number;
};

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, PdfDocumentoTemp>();

function limparExpirados() {
  const agora = Date.now();
  for (const [chave, item] of cache) {
    if (item.expira <= agora) cache.delete(chave);
  }
}

export function sanitizarNomeArquivoPdf(nome: string) {
  const limpo = nome
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  if (!limpo) return "documento.pdf";
  return limpo.toLowerCase().endsWith(".pdf") ? limpo : `${limpo}.pdf`;
}

export function guardarPdfDocumentoTemp(nomeArquivo: string, buffer: Buffer): string {
  limparExpirados();
  const chave = randomBytes(16).toString("hex");
  cache.set(chave, {
    buffer,
    nome: sanitizarNomeArquivoPdf(nomeArquivo),
    expira: Date.now() + TTL_MS,
  });
  return chave;
}

export function lerPdfDocumentoTemp(chave: string): PdfDocumentoTemp | null {
  limparExpirados();
  const item = cache.get(chave);
  if (!item) return null;
  if (item.expira <= Date.now()) {
    cache.delete(chave);
    return null;
  }
  return item;
}
