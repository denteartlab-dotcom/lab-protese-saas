export type AnexoOs = {
  name: string;
  type: string;
  url: string;
};

export function anexosFromInstrucoes(instrucoes?: string | null): AnexoOs[] {
  return (instrucoes || "")
    .split("\n")
    .map((line) => {
      if (!line.trim().startsWith("Arquivo anexado:")) return null;
      const [name, type, url] = line
        .replace(/^Arquivo anexado:/i, "")
        .split("|")
        .map((item) => item.trim());
      if (!url) return null;
      return { name: name || "Arquivo", type: type || "", url };
    })
    .filter((item): item is AnexoOs => item !== null);
}

export function instrucoesSemAnexos(instrucoes?: string | null) {
  return (instrucoes || "")
    .split("\n")
    .filter(
      (line) =>
        !line.trim().startsWith("Arquivo anexado:") &&
        !line.trim().startsWith("Arquivos anexados:")
    )
    .join("\n");
}

/** Anexos de todos os registros do mesmo protocolo (serviço, produto, transporte). */
export function anexosFromGrupoTrabalhos(
  trabalhos: Array<{ instrucoes?: string | null }>
): AnexoOs[] {
  const vistos = new Set<string>();
  const anexos: AnexoOs[] = [];
  for (const trabalho of trabalhos) {
    for (const anexo of anexosFromInstrucoes(trabalho.instrucoes)) {
      if (vistos.has(anexo.url)) continue;
      vistos.add(anexo.url);
      anexos.push(anexo);
    }
  }
  return anexos;
}
