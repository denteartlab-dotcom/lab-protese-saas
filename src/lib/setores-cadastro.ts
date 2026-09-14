import { readStorage } from "@/lib/persisted-storage";

export const SETORES_STORAGE_KEY = "labProteseSetores";
export const SETOR_COR_FALLBACK = "#94a3b8";

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

export function normalizarCorSetor(cor?: string | null) {
  const bruto = (cor || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(bruto)) return bruto;
  if (/^[0-9a-fA-F]{6}$/.test(bruto)) return `#${bruto}`;
  return "";
}

export function setorCadastroPorNome(nome: string, setores: SetorCadastro[]) {
  const chave = nome.trim().toLowerCase();
  if (!chave) return null;
  return (
    setores.find((item) => item.nome.trim().toLowerCase() === chave) ?? null
  );
}

export function corSetorPorNome(
  nome: string,
  setores: SetorCadastro[] = carregarSetoresCadastro(),
  fallback = SETOR_COR_FALLBACK
) {
  const setor = setorCadastroPorNome(nome, setores);
  return normalizarCorSetor(setor?.cor) || fallback;
}

export function corTextoSobreFundoSetor(hex: string) {
  const limpo = hex.replace("#", "");
  if (limpo.length !== 6) return "#374151";
  const r = Number.parseInt(limpo.slice(0, 2), 16);
  const g = Number.parseInt(limpo.slice(2, 4), 16);
  const b = Number.parseInt(limpo.slice(4, 6), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.62 ? "#374151" : "#ffffff";
}

export function estiloBadgeSetor(
  nome: string,
  setores: SetorCadastro[] = carregarSetoresCadastro()
) {
  const fundo = corSetorPorNome(nome, setores);
  return {
    backgroundColor: fundo,
    color: corTextoSobreFundoSetor(fundo),
  };
}
