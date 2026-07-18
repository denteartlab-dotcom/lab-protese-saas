const TTL_MS = 10 * 60 * 1000;

type EntradaPdf = {
  empresaId: string;
  bytes: Buffer;
  nomeArquivo: string;
  exp: number;
};

const cachePdf = new Map<string, EntradaPdf>();

function limparExpirados() {
  const agora = Date.now();
  for (const [id, item] of cachePdf) {
    if (item.exp <= agora) cachePdf.delete(id);
  }
}

export function salvarPdfFaturaImpressaoServidor(
  id: string,
  empresaId: string,
  bytes: Buffer,
  nomeArquivo: string
) {
  limparExpirados();
  const existente = cachePdf.get(id);
  if (existente && existente.empresaId !== empresaId) {
    throw new Error("PDF de impressão já pertence a outro laboratório.");
  }
  cachePdf.set(id, {
    empresaId,
    bytes,
    nomeArquivo: nomeArquivo.trim() || "Fatura.pdf",
    exp: Date.now() + TTL_MS,
  });
}

export function lerPdfFaturaImpressaoServidor(id: string, empresaId: string) {
  const item = cachePdf.get(id);
  if (!item) return null;
  if (item.exp <= Date.now()) {
    cachePdf.delete(id);
    return null;
  }
  if (item.empresaId !== empresaId) return null;
  return item;
}
