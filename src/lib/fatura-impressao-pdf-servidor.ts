const TTL_MS = 10 * 60 * 1000;

type EntradaPdf = {
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
  bytes: Buffer,
  nomeArquivo: string
) {
  limparExpirados();
  cachePdf.set(id, {
    bytes,
    nomeArquivo: nomeArquivo.trim() || "Fatura.pdf",
    exp: Date.now() + TTL_MS,
  });
}

export function lerPdfFaturaImpressaoServidor(id: string) {
  const item = cachePdf.get(id);
  if (!item) return null;
  if (item.exp <= Date.now()) {
    cachePdf.delete(id);
    return null;
  }
  return item;
}
