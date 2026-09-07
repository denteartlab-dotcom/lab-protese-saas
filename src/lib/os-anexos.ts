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

/** Texto após "Origem entrada:" — "Cliente" ou nome de quem criou a OS. */
export const PREFIXO_ORIGEM_ENTRADA = "Origem entrada:";

export function linhaOrigemEntradaOs(rotulo: string): string {
  const limpo = rotulo.trim() || "Usuario";
  return `${PREFIXO_ORIGEM_ENTRADA} ${limpo}`;
}

export function extrairRotuloOrigemEntradaLinha(
  ...textos: Array<string | null | undefined>
): string | null {
  for (const texto of textos) {
    for (const line of (texto || "").split("\n")) {
      const match = line.trim().match(/^origem entrada:\s*(.+)$/i);
      const valor = match?.[1]?.trim();
      if (valor) return valor;
    }
  }
  return null;
}

export function origemEntradaEhCliente(
  ...textos: Array<string | null | undefined>
): boolean {
  const rotulo = extrairRotuloOrigemEntradaLinha(...textos);
  if (rotulo && /^cliente$/i.test(rotulo)) return true;
  const blob = textos
    .map((t) => (t || "").toLowerCase())
    .join("\n");
  return (
    blob.includes("solicitação de envio") || blob.includes("solicitacao de envio")
  );
}

function rotuloEhLaboratorioGenerico(rotulo: string) {
  return /^laborat[oó]rio$/i.test(rotulo.trim());
}

/** Precisa buscar o nome do criador (auditoria) para exibir na coluna Entrada. */
export function precisaNomeCriadorEntrada(
  ...textos: Array<string | null | undefined>
): boolean {
  if (origemEntradaEhCliente(...textos)) return false;
  const rotulo = extrairRotuloOrigemEntradaLinha(...textos);
  if (!rotulo) return true;
  return rotuloEhLaboratorioGenerico(rotulo);
}

/** Rótulo da coluna Entrada a partir das instruções/observações. */
export function rotuloOrigemEntradaDeTexto(
  ...textos: Array<string | null | undefined>
): string {
  const rotulo = extrairRotuloOrigemEntradaLinha(...textos);
  if (rotulo) return rotulo;
  if (origemEntradaEhCliente(...textos)) return "Cliente";
  return "—";
}

/**
 * Garante a marca de origem nas instruções.
 * Pedido do cliente → "Cliente"; OS do lab → nome do usuário criador.
 */
export function garantirOrigemEntradaNasInstrucoes(
  instrucoes: string | null | undefined,
  observacoes: string | null | undefined,
  nomeCriadorLab: string
): string {
  const corpo = (instrucoes || "").trim();
  const existente = extrairRotuloOrigemEntradaLinha(corpo);

  if (origemEntradaEhCliente(corpo, observacoes)) {
    if (existente && /^cliente$/i.test(existente)) return corpo;
    const limpo = corpo
      .split("\n")
      .filter((line) => !/^origem entrada:/i.test(line.trim()))
      .join("\n")
      .trim();
    return [linhaOrigemEntradaOs("Cliente"), limpo].filter(Boolean).join("\n");
  }

  if (existente && !rotuloEhLaboratorioGenerico(existente)) {
    return corpo;
  }

  const limpo = corpo
    .split("\n")
    .filter((line) => !/^origem entrada:/i.test(line.trim()))
    .join("\n")
    .trim();
  return [linhaOrigemEntradaOs(nomeCriadorLab), limpo].filter(Boolean).join("\n");
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
