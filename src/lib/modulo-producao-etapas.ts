import { readStorage, writeStorage } from "@/lib/persisted-storage";

const STORAGE_KEY = "labProteseModuloProducaoEtapas";

type MapaEtapas = Record<string, number[]>;

function lerMapa(): MapaEtapas {
  if (typeof window === "undefined") return {};
  const parsed = readStorage<MapaEtapas>(STORAGE_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
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
  writeStorage(STORAGE_KEY, mapa);
}
