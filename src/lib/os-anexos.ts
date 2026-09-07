export type AnexoOs = {
  name: string;
  type: string;
  url: string;
  /** Tamanho em bytes, quando conhecido (uploads novos). */
  tamanho?: number;
};

/** Sem limite de quantidade; teto de volume total dos anexos da OS. */
export const LIMITE_MB_TOTAL_ANEXOS_OS = 310;
export const LIMITE_BYTES_TOTAL_ANEXOS_OS =
  LIMITE_MB_TOTAL_ANEXOS_OS * 1024 * 1024;

export function bytesArquivosOs(arquivos: Array<{ size: number }>): number {
  return arquivos.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
}

export function bytesAnexosOsExistentes(
  anexos: Array<{ tamanho?: number }>
): number {
  return anexos.reduce((acc, a) => acc + (Number(a.tamanho) || 0), 0);
}

export function formatarMbUsados(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return mb === 0 ? "0" : mb.toFixed(2);
  if (mb < 10) return mb.toFixed(1);
  return String(Math.round(mb));
}

/** Origem da OS no controle: pedido do cliente vs criação no laboratório. */
export type OrigemEntradaOs = "cliente" | "laboratorio";

export const MARCA_ORIGEM_ENTRADA_CLIENTE = "Origem entrada: Cliente";
export const MARCA_ORIGEM_ENTRADA_LABORATORIO = "Origem entrada: Laboratorio";

export function linhaOrigemEntradaOs(origem: OrigemEntradaOs): string {
  return origem === "cliente"
    ? MARCA_ORIGEM_ENTRADA_CLIENTE
    : MARCA_ORIGEM_ENTRADA_LABORATORIO;
}

export function origemEntradaOsDeTexto(
  ...textos: Array<string | null | undefined>
): OrigemEntradaOs {
  const blob = textos
    .map((t) => (t || "").trim())
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  if (!blob) return "laboratorio";
  if (
    blob.includes("origem entrada: cliente") ||
    blob.includes("solicitação de envio") ||
    blob.includes("solicitacao de envio")
  ) {
    return "cliente";
  }
  if (blob.includes("origem entrada: laboratorio") || blob.includes("origem entrada: laboratório")) {
    return "laboratorio";
  }
  return "laboratorio";
}

export function rotuloOrigemEntradaOs(origem: OrigemEntradaOs): string {
  return origem === "cliente" ? "Cliente" : "Laboratorio";
}

export function anexosFromInstrucoes(instrucoes?: string | null): AnexoOs[] {
  const vistos = new Set<string>();
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
    .filter((item): item is AnexoOs => {
      if (!item || vistos.has(item.url)) return false;
      vistos.add(item.url);
      return true;
    });
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
