import { semAcento } from "@/lib/busca-texto";
import { extrairNumeroOsCodigo, limparEntradaLeitorCodigo } from "@/lib/codigo-barras-os";

const PREFIXO_OS_EXTERNA = /^os\s+extern[ao]\s*:/i;
const PREFIXO_OS_INTERNA = /^os\s+interna\s*:/i;

/** Número informado na criação da OS (linha `OS Externa:` nas instruções). */
export function extrairOsExterna(instrucoes?: string | null): string {
  const line = (instrucoes || "")
    .split("\n")
    .map((item) => item.trim())
    .find((item) => PREFIXO_OS_EXTERNA.test(item) || PREFIXO_OS_INTERNA.test(item));
  if (!line) return "";
  const idx = line.indexOf(":");
  return idx >= 0 ? line.slice(idx + 1).trim() : "";
}

export function linhaOsExterna(valor?: string | null): string {
  const texto = (valor || "").trim();
  return texto ? `OS Externa: ${texto}` : "";
}

function variantesCodigo(valor: string): Set<string> {
  const norm = semAcento(valor).replace(/[^a-z0-9]/g, "");
  const set = new Set<string>();
  if (!norm) return set;
  set.add(norm);
  if (/^\d+$/.test(norm)) set.add(norm.replace(/^0+/, "") || "0");
  return set;
}

/** O termo digitado é o mesmo código, ignorando maiúsculas, pontos e zeros à esquerda. */
export function codigoOsCombina(armazenado: string, termo: string): boolean {
  const gravado = variantesCodigo(armazenado);
  if (gravado.size === 0) return false;
  const buscado = variantesCodigo(termo);
  for (const item of buscado) {
    if (gravado.has(item)) return true;
  }
  const numero = extrairNumeroOsCodigo(termo);
  if (numero && numero !== termo.trim()) {
    for (const item of variantesCodigo(numero)) {
      if (gravado.has(item)) return true;
    }
  }
  return false;
}

export function osExternaCombinaTermo(instrucoes: string | null | undefined, termo: string) {
  return codigoOsCombina(extrairOsExterna(instrucoes), termo);
}

/** Número interno só quando a busca é o número da OS ou a leitura `OS123`. */
export function numeroOsInternoDaBusca(termo: string): number | null {
  const limpo = limparEntradaLeitorCodigo(termo)
    .replace(/^\*+|\*+$/g, "")
    .trim();
  if (!limpo) return null;
  if (!/^\d+$/.test(limpo) && !/^OS\s*#?\s*\d+$/i.test(limpo)) return null;
  const n = Number(extrairNumeroOsCodigo(limpo));
  return Number.isFinite(n) && n > 0 ? n : null;
}

type TrabalhoBuscaOs = {
  id?: string;
  numeroOs?: number | null;
  instrucoes?: string | null;
  pacienteNome?: string | null;
  clienteNome?: string | null;
  tipoProtese?: string | null;
};

/**
 * A busca numérica continua no número interno e também na OS Externa.
 * Texto livre (paciente, cliente, serviço) segue valendo quando o termo não é um número de OS.
 */
export function trabalhoCombinaBuscaOs(
  trabalho: TrabalhoBuscaOs,
  termo: string,
  opcoes?: { incluirInstrucoes?: boolean }
) {
  const q = termo.trim();
  if (!q) return true;
  if (trabalho.id && trabalho.id === q) return true;
  if (osExternaCombinaTermo(trabalho.instrucoes, q)) return true;
  const interno = numeroOsInternoDaBusca(q);
  if (interno != null && trabalho.numeroOs === interno) return true;
  if (interno != null) return false;
  const combina = (texto?: string | null) => semAcento(texto).includes(semAcento(q));
  if (combina(trabalho.pacienteNome)) return true;
  if (combina(trabalho.clienteNome)) return true;
  if (combina(trabalho.tipoProtese)) return true;
  if (opcoes?.incluirInstrucoes && combina(trabalho.instrucoes)) return true;
  return false;
}
