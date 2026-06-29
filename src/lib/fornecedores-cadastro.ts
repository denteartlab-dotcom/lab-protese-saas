import { readStorageArray, writeStorage } from "@/lib/persisted-storage";

export const FORNECEDORES_STORAGE_KEY = "labProteseFornecedores";
export const CATEGORIAS_FORNECEDORES_STORAGE_KEY = "labProteseCategoriasFornecedores";
export const FORNECEDORES_ATUALIZADO_EVENT = "labProteseFornecedoresAtualizado";

export type FornecedorCadastro = {
  id: string;
  nome: string;
  contato: string;
  celular: string;
  whatsapp: string;
  email: string;
  cpf?: string;
  cnpj?: string;
  categoria?: string;
  telefoneResidencial?: string;
  telefoneComercial?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
  bairro?: string;
  complemento?: string;
  representanteTelefoneComercial?: string;
  representanteWhatsapp?: string;
  representanteEmail?: string;
};

export type FornecedorFormulario = Omit<FornecedorCadastro, "id">;

export const fornecedorFormularioVazio = (): FornecedorFormulario => ({
  nome: "",
  cpf: "",
  cnpj: "",
  categoria: "",
  telefoneResidencial: "",
  telefoneComercial: "",
  celular: "",
  whatsapp: "",
  email: "",
  cep: "",
  rua: "",
  numero: "",
  cidade: "",
  uf: "",
  bairro: "",
  complemento: "",
  contato: "",
  representanteTelefoneComercial: "",
  representanteWhatsapp: "",
  representanteEmail: "",
});

export function carregarFornecedoresCadastro(): FornecedorCadastro[] {
  if (typeof window === "undefined") return [];
  return readStorageArray<FornecedorCadastro>(FORNECEDORES_STORAGE_KEY, []);
}

export function carregarCategoriasFornecedor(): string[] {
  if (typeof window === "undefined") return [];
  return readStorageArray<string>(CATEGORIAS_FORNECEDORES_STORAGE_KEY, []);
}

export function salvarCategoriasFornecedor(categorias: string[]) {
  writeStorage(CATEGORIAS_FORNECEDORES_STORAGE_KEY, categorias);
}

export function notificarFornecedoresAtualizado() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FORNECEDORES_ATUALIZADO_EVENT));
}

export function salvarNovoFornecedor(dados: FornecedorFormulario): FornecedorCadastro | null {
  const nome = dados.nome.trim();
  if (!nome) return null;

  const novo: FornecedorCadastro = {
    id: crypto.randomUUID(),
    ...dados,
    nome,
  };

  const lista = carregarFornecedoresCadastro();
  lista.push(novo);
  writeStorage(FORNECEDORES_STORAGE_KEY, lista);
  notificarFornecedoresAtualizado();
  return novo;
}

export function formatCepInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`;
}
