/** Compara texto de busca ignorando maiúsculas e acentos (jose encontra José). */
export function semAcento(valor: string | number | null | undefined) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function textoCombinaBusca(
  texto: string | number | null | undefined,
  termo: string | null | undefined
) {
  const q = semAcento(termo).trim();
  if (!q) return true;
  return semAcento(texto).includes(q);
}

export function algumTextoCombinaBusca(
  textos: Array<string | number | null | undefined>,
  termo: string | null | undefined
) {
  const q = semAcento(termo).trim();
  if (!q) return true;
  return textos.some((item) => semAcento(item).includes(q));
}
