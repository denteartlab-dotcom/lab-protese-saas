import type { EtapaOsLinha } from "@/lib/etapas-os";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

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

export async function persistirEtapaAtualOs(opts: {
  trabalhoId: string;
  itemId: string;
  indiceAtual: number;
}) {
  if (typeof window === "undefined") return;
  const chave = chaveEtapasModuloOs(opts.trabalhoId, opts.itemId);
  const concluidas = indicesConcluidasDeIndiceAtual(opts.indiceAtual);
  salvarEtapasConcluidasModulo(chave, new Set(concluidas));

  try {
    const res = await fetch(`/api/json-store/${MODULO_PRODUCAO_ETAPAS_STORAGE_KEY}`);
    let mapa: MapaEtapas = {};
    if (res.ok) {
      const body = await res.json();
      if (body && typeof body === "object" && !Array.isArray(body)) {
        mapa = body as MapaEtapas;
      }
    }
    mapa[chave] = concluidas;
    await fetch(`/api/json-store/${MODULO_PRODUCAO_ETAPAS_STORAGE_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mapa),
    });
  } catch {
    /* localStorage já atualizado; TV sincroniza na próxima leitura do servidor */
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
  const concluidas = etapasConcluidasModulo(chaveEtapasModuloOs(trabalhoId, itemId));
  for (const etapa of etapas) {
    if (!concluidas.has(etapa.indice)) return etapa;
  }
  return etapas[etapas.length - 1];
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
