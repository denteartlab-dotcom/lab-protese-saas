import {
  persistirArmazenamentoImediato,
  readStorageArray,
  writeStorage,
} from "@/lib/persisted-storage";

export const MATERIAIS_DENTISTA_STORAGE_KEY = "labProteseMateriaisDentista";
export const MATERIAIS_DENTISTA_ATUALIZADA_EVENT = "lab-materiais-dentista-atualizada";

function normalizarListaMateriais(materiais: string[]) {
  return materiais.map((material) => String(material).trim()).filter(Boolean);
}

/** Lista do PostgreSQL (JsonStore). Conta nova permanece vazia — sem materiais de exemplo. */
export function carregarMateriaisDentistaCadastro(): string[] {
  const lista = readStorageArray<string>(MATERIAIS_DENTISTA_STORAGE_KEY, []);
  return normalizarListaMateriais(lista);
}

export async function salvarMateriaisDentistaCadastro(materiais: string[]) {
  const normalizadas = normalizarListaMateriais(materiais);
  writeStorage(MATERIAIS_DENTISTA_STORAGE_KEY, normalizadas);
  await persistirArmazenamentoImediato(MATERIAIS_DENTISTA_STORAGE_KEY, normalizadas);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MATERIAIS_DENTISTA_ATUALIZADA_EVENT));
  }
  return normalizadas;
}

export async function adicionarMaterialDentistaCadastro(nome: string, materiaisAtuais: string[]) {
  const material = nome.trim();
  if (!material) return materiaisAtuais;
  const existe = materiaisAtuais.some(
    (item) => item.toLowerCase() === material.toLowerCase()
  );
  if (existe) return materiaisAtuais;
  return salvarMateriaisDentistaCadastro([...materiaisAtuais, material]);
}

export async function removerMaterialDentistaCadastro(nome: string, materiaisAtuais: string[]) {
  const proxima = materiaisAtuais.filter(
    (item) => item.toLowerCase() !== nome.trim().toLowerCase()
  );
  return salvarMateriaisDentistaCadastro(proxima);
}
