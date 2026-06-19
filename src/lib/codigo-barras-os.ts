/** Valor Code39 impresso na OS e na fatura — mesmo padrão do leitor USB. */
export function valorCodigoBarrasOs(numeroOs: number | string): string {
  const n = String(numeroOs).replace(/\D/g, "");
  return n ? `OS${n}` : "";
}

/** Remove caracteres de controle enviados por leitores USB (Enter, Tab, etc.). */
export function limparEntradaLeitorCodigo(raw: string): string {
  return raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

/** Extrai o número da OS de leitura do código (ex.: OS7, *OS12*, só dígitos). */
export function extrairNumeroOsCodigo(raw: string): string {
  const t = limparEntradaLeitorCodigo(raw).replace(/^\*+|\*+$/g, "");
  if (!t) return "";
  const prefixo = t.match(/^OS\s*#?\s*(\d+)/i);
  if (prefixo) return prefixo[1];
  const digitos = t.replace(/\D/g, "");
  return digitos || "";
}

/** Números de OS únicos nas linhas da fatura (para códigos de barras). */
export function numerosOsUnicosDasLinhas(
  linhas: Array<{ os: string }>
): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const linha of linhas) {
    const numero = extrairNumeroOsCodigo(linha.os);
    if (!numero || vistos.has(numero)) continue;
    vistos.add(numero);
    lista.push(numero);
  }
  return lista;
}
