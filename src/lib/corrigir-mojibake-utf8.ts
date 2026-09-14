/**
 * Corrige texto UTF-8 que foi gravado/lido como Latin-1 (ex.: "ServiÃ§o" → "Serviço").
 * Usado ao ler linhas antigas de instrução da OS no banco.
 */
export function corrigirMojibakeUtf8(texto: string): string {
  if (!texto || !/[ÃÂ]|â€|â†/.test(texto)) return texto;
  try {
    const bytes = new Uint8Array(texto.length);
    for (let i = 0; i < texto.length; i++) {
      const code = texto.charCodeAt(i);
      if (code > 255) return texto;
      bytes[i] = code;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return texto;
  }
}
