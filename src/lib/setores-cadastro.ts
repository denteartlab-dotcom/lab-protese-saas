import { readStorage } from "@/lib/persisted-storage";

export const SETORES_STORAGE_KEY = "labProteseSetores";

export type SetorCadastro = {
  id: string;
  nome: string;
  cor: string;
};

export function carregarSetoresCadastro(): SetorCadastro[] {
  const lista = readStorage<SetorCadastro[]>(SETORES_STORAGE_KEY, []);
  return filtrarSetoresCadastro(lista);
}

export function filtrarSetoresCadastro(lista: SetorCadastro[]): SetorCadastro[] {
  return Array.isArray(lista) ? lista.filter((s) => s?.nome?.trim()) : [];
}
