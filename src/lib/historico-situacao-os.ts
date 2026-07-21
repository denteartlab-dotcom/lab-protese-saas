/** Histórico de mudanças de situação da OS (Controle de Produção → visualização). */

export const PREFIXO_HISTORICO_SITUACAO = "Historico situacao:";

export type EntradaHistoricoSituacao = {
  /** Data local da mudança (YYYY-MM-DD). */
  data: string;
  status: string;
};

export function ehLinhaHistoricoSituacao(line: string) {
  return line.trim().toLowerCase().startsWith(PREFIXO_HISTORICO_SITUACAO.toLowerCase());
}

function dataLocalIso(quando: Date = new Date()) {
  const y = quando.getFullYear();
  const m = String(quando.getMonth() + 1).padStart(2, "0");
  const d = String(quando.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseHistoricoSituacao(
  instrucoes?: string | null
): EntradaHistoricoSituacao[] {
  const entradas: EntradaHistoricoSituacao[] = [];
  for (const line of (instrucoes || "").split("\n")) {
    if (!ehLinhaHistoricoSituacao(line)) continue;
    const resto = line.trim().slice(PREFIXO_HISTORICO_SITUACAO.length).trim();
    const [data, status] = resto.split("|").map((p) => p.trim());
    if (!data || !status) continue;
    entradas.push({ data, status: status.toLowerCase() });
  }
  return entradas;
}

export function instrucoesSemHistoricoSituacao(instrucoes?: string | null) {
  return (instrucoes || "")
    .split("\n")
    .filter((line) => !ehLinhaHistoricoSituacao(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Mantém o histórico antigo quando o cliente regrava instruções sem essas linhas. */
export function mesclarPreservandoHistoricoSituacao(
  instrucoesNovas: string | null | undefined,
  instrucoesAnteriores: string | null | undefined
): string {
  const corpo = instrucoesSemHistoricoSituacao(instrucoesNovas);
  const linhasHist = (instrucoesAnteriores || "")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => ehLinhaHistoricoSituacao(l));
  if (!linhasHist.length) return corpo;
  return corpo ? `${corpo}\n${linhasHist.join("\n")}` : linhasHist.join("\n");
}

export function adicionarHistoricoSituacaoInstrucoes(
  instrucoes: string | null | undefined,
  status: string,
  quando: Date = new Date()
): string {
  const statusNorm = status.trim().toLowerCase();
  if (!statusNorm) return instrucoes || "";
  const linha = `${PREFIXO_HISTORICO_SITUACAO} ${dataLocalIso(quando)}|${statusNorm}`;
  const base = (instrucoes || "").trimEnd();
  return base ? `${base}\n${linha}` : linha;
}

/** Formata data YYYY-MM-DD como 21/07/26. */
export function formatarDataHistoricoSituacao(
  dataIso: string,
  locale: string
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso.trim());
  if (!match) return dataIso;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  const tag = locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US";
  return date.toLocaleDateString(tag, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function textoHistoricoSituacaoExibicao(
  entradas: EntradaHistoricoSituacao[],
  rotuloStatus: (status: string) => string,
  locale: string
): string {
  return entradas
    .map(
      (e) =>
        `${formatarDataHistoricoSituacao(e.data, locale)}: ${rotuloStatus(e.status)}`
    )
    .join("\n");
}
