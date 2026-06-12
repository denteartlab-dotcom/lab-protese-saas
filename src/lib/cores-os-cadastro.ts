import {
  chaveExisteNoServidor,
  persistirArmazenamentoImediato,
  readStorage,
  writeStorage,
} from "@/lib/persisted-storage";

export const CORES_OS_STORAGE_KEY = "labProteseCoresOs";
export const CORES_OS_ATUALIZADA_EVENT = "lab-cores-os-atualizada";

export const CORES_OS_PADRAO: readonly string[] = [
  "A1",
  "A2",
  "A3",
  "A3.5",
  "A4",
  "B1",
  "B2",
  "B3",
  "B4",
  "C1",
  "C2",
  "C3",
  "C4",
  "D2",
  "D3",
  "D4",
  "BL1",
  "BL2",
  "BL3",
  "BL4",
];

export function carregarCoresOsCadastro(): string[] {
  if (!chaveExisteNoServidor(CORES_OS_STORAGE_KEY)) {
    return [...CORES_OS_PADRAO];
  }
  const lista = readStorage<string[]>(CORES_OS_STORAGE_KEY, []);
  if (!Array.isArray(lista)) return [];
  return lista.map((cor) => String(cor).trim()).filter(Boolean);
}

export function salvarCoresOsCadastro(cores: string[]) {
  const normalizadas = cores.map((cor) => cor.trim()).filter(Boolean);
  writeStorage(CORES_OS_STORAGE_KEY, normalizadas);
  void persistirArmazenamentoImediato(CORES_OS_STORAGE_KEY, normalizadas);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CORES_OS_ATUALIZADA_EVENT));
  }
}

export function adicionarCorOsCadastro(nome: string, coresAtuais: string[]) {
  const cor = nome.trim();
  if (!cor) return coresAtuais;
  const existe = coresAtuais.some(
    (item) => item.toLowerCase() === cor.toLowerCase()
  );
  if (existe) return coresAtuais;
  const proxima = [...coresAtuais, cor];
  salvarCoresOsCadastro(proxima);
  return proxima;
}

export function removerCorOsCadastro(nome: string, coresAtuais: string[]) {
  const proxima = coresAtuais.filter(
    (item) => item.toLowerCase() !== nome.trim().toLowerCase()
  );
  salvarCoresOsCadastro(proxima);
  return proxima;
}
