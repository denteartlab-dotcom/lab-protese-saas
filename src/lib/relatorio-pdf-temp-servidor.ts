/** PDFs temporários gerados por jobs (issue 015) — TTL 1 h. */

const TTL_MS = 60 * 60 * 1000;

type EntradaPdfTemp = {
  empresaId: string;
  base64: string;
  nomeArquivo: string;
  titulo: string;
  exp: number;
};

const cache = new Map<string, EntradaPdfTemp>();

function limparExpirados() {
  const agora = Date.now();
  for (const [id, item] of cache) {
    if (item.exp <= agora) cache.delete(id);
  }
}

export function salvarRelatorioPdfTemp(
  id: string,
  empresaId: string,
  dados: { base64: string; nomeArquivo: string; titulo: string }
) {
  limparExpirados();
  cache.set(id, {
    empresaId,
    base64: dados.base64,
    nomeArquivo: dados.nomeArquivo,
    titulo: dados.titulo,
    exp: Date.now() + TTL_MS,
  });
}

export function lerRelatorioPdfTemp(empresaId: string, id: string) {
  const item = cache.get(id);
  if (!item) return null;
  if (item.exp <= Date.now()) {
    cache.delete(id);
    return null;
  }
  if (item.empresaId !== empresaId) return null;
  return item;
}
