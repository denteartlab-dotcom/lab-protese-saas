import { readStorage } from "@/lib/persisted-storage";

export const PRESTADORES_STORAGE_KEY = "labProtesePrestadores";

export type PrestadorListagem = {
  id: string;
  nome: string;
  tipoServico: string;
  valorComissao: string;
  valorComissaoRepeticao: string;
};

type PrestadorStorage = {
  id: string;
  nome: string;
  tipoServico?: string;
  valorComissao?: string;
  valorComissaoRepeticao?: string;
};

export function carregarPrestadoresListagem(): PrestadorListagem[] {
  const lista = readStorage<PrestadorStorage[]>(PRESTADORES_STORAGE_KEY, []);
  return lista
    .map((item) => ({
      id: item.id || item.nome,
      nome: item.nome?.trim() || "",
      tipoServico: item.tipoServico?.trim() || "",
      valorComissao: item.valorComissao || "0,00%",
      valorComissaoRepeticao: item.valorComissaoRepeticao || "0,00%",
    }))
    .filter((p) => p.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
