import type { EtapaOsLinha } from "@/lib/etapas-os";
import { persistirArmazenamentoImediato, readStorage, writeStorage } from "@/lib/persisted-storage";

export const MODULO_PRODUCAO_ETAPAS_STORAGE_KEY = "labProteseModuloProducaoEtapas";

type MapaEtapas = Record<string, number[]>;

export type SituacaoEtapaServico = "concluida" | "atual" | "aguardando";

export function chaveEtapasModuloOs(trabalhoId: string, itemId: string) {
  return `${trabalhoId}:${itemId}`;
}

/** Primeira etapa não concluída (é a que aparece no Módulo TV). */
export function indiceEtapaAtualDeConcluidas(
  concluidas: Iterable<number>,
  totalEtapas: number
): number {
  if (totalEtapas <= 0) return 0;
  const set = new Set(concluidas);
  for (let i = 0; i < totalEtapas; i++) {
    if (!set.has(i)) return i;
  }
  return Math.max(0, totalEtapas - 1);
}

export function indicesConcluidasDeIndiceAtual(indiceAtual: number): number[] {
  const indice = Math.max(0, Math.floor(indiceAtual));
  return Array.from({ length: indice }, (_, i) => i);
}

export function situacaoEtapaServico(
  index: number,
  indiceAtual: number
): SituacaoEtapaServico {
  if (index < indiceAtual) return "concluida";
  if (index === indiceAtual) return "atual";
  return "aguardando";
}

/** Última etapa concluída em sequência (0, 1, 2…), ou -1 se nenhuma. */
export function ultimoIndiceConcluidoSequencial(concluidas: Iterable<number>): number {
  const set = new Set(concluidas);
  let ultimo = -1;
  while (set.has(ultimo + 1)) ultimo += 1;
  return ultimo;
}

export const MENSAGEM_ETAPA_EXIGE_ANTERIOR =
  "Conclua a etapa atual antes de avançar para a próxima.";

export const MENSAGEM_ETAPA_REABRIR_SEQUENCIAL =
  "Só é possível desfazer a última etapa concluída em sequência.";

export function podeAlternarEtapaConcluida(opts: {
  indice: number;
  concluidas: Iterable<number>;
  totalEtapas: number;
  exigeAnteriorFinalizada: boolean;
  marcandoConcluida: boolean;
}): { permitido: boolean; motivo?: string } {
  const { indice, concluidas, totalEtapas, exigeAnteriorFinalizada, marcandoConcluida } =
    opts;
  if (!exigeAnteriorFinalizada) return { permitido: true };
  if (indice < 0 || indice >= totalEtapas) {
    return { permitido: false, motivo: "Etapa inválida." };
  }

  const set = new Set(concluidas);
  const etapaAtual = indiceEtapaAtualDeConcluidas(set, totalEtapas);

  if (marcandoConcluida) {
    if (indice !== etapaAtual) {
      return { permitido: false, motivo: MENSAGEM_ETAPA_EXIGE_ANTERIOR };
    }
    return { permitido: true };
  }

  const ultimoConcluido = ultimoIndiceConcluidoSequencial(set);
  if (!set.has(indice) || indice !== ultimoConcluido) {
    return { permitido: false, motivo: MENSAGEM_ETAPA_REABRIR_SEQUENCIAL };
  }
  return { permitido: true };
}

export function podeDefinirIndiceEtapaAtual(opts: {
  indiceAtual: number;
  novoIndice: number;
  totalEtapas: number;
  exigeAnteriorFinalizada: boolean;
}): { permitido: boolean; motivo?: string } {
  const { indiceAtual, novoIndice, totalEtapas, exigeAnteriorFinalizada } = opts;
  if (!exigeAnteriorFinalizada) return { permitido: true };
  if (novoIndice < 0 || novoIndice > totalEtapas) {
    return { permitido: false, motivo: "Etapa inválida." };
  }
  if (novoIndice === indiceAtual) return { permitido: true };

  const delta = novoIndice - indiceAtual;
  if (delta === 1) return { permitido: true };
  if (delta === -1) return { permitido: true };

  if (delta > 1) {
    return { permitido: false, motivo: MENSAGEM_ETAPA_EXIGE_ANTERIOR };
  }
  return { permitido: false, motivo: MENSAGEM_ETAPA_REABRIR_SEQUENCIAL };
}

export function indiceEtapaAposSituacao(
  index: number,
  situacao: SituacaoEtapaServico,
  indiceAtual: number,
  totalEtapas: number
): number | null {
  if (situacao === "atual") return index;
  if (situacao === "concluida") return Math.min(index + 1, totalEtapas);
  if (situacao === "aguardando" && index === indiceAtual) {
    return Math.min(index + 1, Math.max(0, totalEtapas - 1));
  }
  return null;
}

export function podeAlterarSituacaoEtapaServico(opts: {
  index: number;
  situacao: SituacaoEtapaServico;
  indiceAtual: number;
  totalEtapas: number;
  exigeAnteriorFinalizada: boolean;
}): { permitido: boolean; motivo?: string; novoIndice?: number } {
  const { index, situacao, indiceAtual, totalEtapas, exigeAnteriorFinalizada } = opts;
  const novoIndice = indiceEtapaAposSituacao(index, situacao, indiceAtual, totalEtapas);
  if (novoIndice === null) return { permitido: true };

  const validacao = podeDefinirIndiceEtapaAtual({
    indiceAtual,
    novoIndice,
    totalEtapas,
    exigeAnteriorFinalizada,
  });
  if (!validacao.permitido) return validacao;
  return { permitido: true, novoIndice };
}

export async function persistirEtapaAtualOs(opts: {
  trabalhoId: string;
  itemId: string;
  indiceAtual: number;
}) {
  if (typeof window === "undefined") return;
  const chave = chaveEtapasModuloOs(opts.trabalhoId, opts.itemId);
  const concluidas = indicesConcluidasDeIndiceAtual(opts.indiceAtual);
  const mapa = lerMapa();
  mapa[chave] = concluidas;
  writeStorage(MODULO_PRODUCAO_ETAPAS_STORAGE_KEY, mapa);
  try {
    await persistirArmazenamentoImediato(MODULO_PRODUCAO_ETAPAS_STORAGE_KEY, mapa);
  } catch {
    /* espelho local mantido; próxima gravação tenta de novo */
  }
}

function lerMapa(): MapaEtapas {
  if (typeof window === "undefined") return {};
  const parsed = readStorage<MapaEtapas>(MODULO_PRODUCAO_ETAPAS_STORAGE_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

/** Mapa de etapas concluídas por chave `trabalhoId:itemId`. */
export function lerMapaEtapasConcluidasModulo(): MapaEtapas {
  return lerMapa();
}

export function indiceEtapaAtualModulo(chave: string, totalEtapas: number): number {
  if (totalEtapas <= 0) return 0;
  return indiceEtapaAtualDeConcluidas(etapasConcluidasModulo(chave), totalEtapas);
}

/** Etapa em andamento da OS (mesma regra do Módulo TV). */
export function etapaAtualLinhaOs(
  etapas: EtapaOsLinha[],
  trabalhoId: string,
  itemId: string
): EtapaOsLinha | undefined {
  if (!etapas.length) return undefined;
  const indice = indiceEtapaAtualModulo(
    chaveEtapasModuloOs(trabalhoId, itemId),
    etapas.length
  );
  return etapas[indice];
}

export function etapasConcluidasModulo(chave: string): Set<number> {
  const mapa = lerMapa();
  const lista = mapa[chave];
  return new Set(Array.isArray(lista) ? lista : []);
}

export function salvarEtapasConcluidasModulo(chave: string, indices: Set<number>) {
  if (typeof window === "undefined") return;
  const mapa = lerMapa();
  mapa[chave] = [...indices];
  writeStorage(MODULO_PRODUCAO_ETAPAS_STORAGE_KEY, mapa);
}
