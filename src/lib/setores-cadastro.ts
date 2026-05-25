import { readStorage } from "@/lib/persisted-storage";

export const SETORES_STORAGE_KEY = "labProteseSetores";

export type SetorCadastro = {
  id: string;
  nome: string;
  cor: string;
};

const setoresPadrao: SetorCadastro[] = [
  { id: "resina", nome: "Resina", cor: "#f25f6a" },
  { id: "metal", nome: "Metal", cor: "#e9a94f" },
];

export function carregarSetoresCadastro(): SetorCadastro[] {
  const lista = readStorage<SetorCadastro[]>(SETORES_STORAGE_KEY, setoresPadrao);
  return lista.filter((s) => s?.nome?.trim());
}
