/** Extrai o número da OS de leitura do código (ex.: OS7, OS#12, só dígitos). */
export function extrairNumeroOsCodigo(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const prefixo = t.match(/^OS\s*#?\s*(\d+)/i);
  if (prefixo) return prefixo[1];
  const digitos = t.replace(/\D/g, "");
  return digitos || t;
}
