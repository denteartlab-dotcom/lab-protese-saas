import {
  persistirArmazenamentoImediato,
  readStorageArray,
  writeStorage,
} from "@/lib/persisted-storage";

export const CORES_OS_STORAGE_KEY = "labProteseCoresOs";
export const CORES_OS_ATUALIZADA_EVENT = "lab-cores-os-atualizada";

export function carregarCoresOsCadastro(): string[] {
  const lista = readStorageArray<string>(CORES_OS_STORAGE_KEY, []);
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
