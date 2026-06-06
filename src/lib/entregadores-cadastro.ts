import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const ENTREGADORES_CADASTRO_STORAGE_KEY = "labProteseEntregadores";
export const ENTREGADORES_EXCLUIDOS_STORAGE_KEY = "labProteseEntregadoresExcluidos";
export const ENTREGADORES_CADASTRO_EVENT = "labProteseEntregadoresCadastroAtualizado";

export type EntregadorCadastro = {
  id: string;
  nome: string;
  celular: string;
  whatsapp: string;
  email: string;
};

function normalizarEntregador(item: Partial<EntregadorCadastro>): EntregadorCadastro | null {
  const nome = String(item.nome || "").trim();
  if (!nome) return null;
  return {
    id: String(item.id || `ent-${nome.toLowerCase().replace(/\s+/g, "-")}`),
    nome,
    celular: String(item.celular || "").trim(),
    whatsapp: String(item.whatsapp || "").trim(),
    email: String(item.email || "").trim(),
  };
}

function migrarListaAntiga(raw: unknown): EntregadorCadastro[] {
  if (!Array.isArray(raw)) return [];
  if (raw.every((item) => typeof item === "string")) {
    return raw
      .map((nome) => normalizarEntregador({ id: `ent-${String(nome)}`, nome: String(nome) }))
      .filter((item): item is EntregadorCadastro => Boolean(item));
  }
  return raw
    .map((item) => normalizarEntregador(item as Partial<EntregadorCadastro>))
    .filter((item): item is EntregadorCadastro => Boolean(item));
}

export function carregarEntregadoresCadastro(): EntregadorCadastro[] {
  const raw = readStorage<unknown>(ENTREGADORES_CADASTRO_STORAGE_KEY, []);
  const lista = migrarListaAntiga(raw);
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function salvarEntregadoresCadastro(lista: EntregadorCadastro[]) {
  const normalizada = lista
    .map((item) => normalizarEntregador(item))
    .filter((item): item is EntregadorCadastro => Boolean(item));
  writeStorage(ENTREGADORES_CADASTRO_STORAGE_KEY, normalizada);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ENTREGADORES_CADASTRO_EVENT));
  }
  return normalizada;
}

export function carregarEntregadoresExcluidos(): EntregadorCadastro[] {
  const raw = readStorage<unknown>(ENTREGADORES_EXCLUIDOS_STORAGE_KEY, []);
  return migrarListaAntiga(raw).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function salvarEntregadoresExcluidos(lista: EntregadorCadastro[]) {
  const normalizada = lista
    .map((item) => normalizarEntregador(item))
    .filter((item): item is EntregadorCadastro => Boolean(item));
  writeStorage(ENTREGADORES_EXCLUIDOS_STORAGE_KEY, normalizada);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ENTREGADORES_CADASTRO_EVENT));
  }
  return normalizada;
}

export function carregarNomesEntregadores(): string[] {
  return carregarEntregadoresCadastro().map((item) => item.nome);
}

export function garantirEntregadorCadastro(nome: string) {
  const termo = nome.trim();
  if (!termo) return;
  const lista = carregarEntregadoresCadastro();
  if (lista.some((item) => item.nome.toLowerCase() === termo.toLowerCase())) return;
  salvarEntregadoresCadastro([
    ...lista,
    {
      id: `ent-${Date.now()}`,
      nome: termo,
      celular: "",
      whatsapp: "",
      email: "",
    },
  ]);
}
