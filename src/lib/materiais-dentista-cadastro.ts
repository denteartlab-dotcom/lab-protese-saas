import { chaveExisteNoServidor, readStorage } from "@/lib/persisted-storage";

export const MATERIAIS_DENTISTA_STORAGE_KEY = "labProteseMateriaisDentista";

export const MATERIAIS_DENTISTA_PADRAO: readonly string[] = [
  "Antagonista",
  "Articulador",
  "Barra Protocolo",
  "Componente Protético",
  "Dente",
  "Estrutura Metálica (PPR)",
  "Modelo de Gesso",
  "Mordida em cera",
  "Muralha de silicone",
  "Outros",
  "Parafuso Implante",
  "Ucla Personalizada",
  "Modelo De Trabalho",
  "Moldeira Sup",
  "Moldeira Inf",
];

/** Lista do PostgreSQL (JsonStore). Lista vazia salva permanece vazia — não restaura padrões. */
export function carregarMateriaisDentistaCadastro(): string[] {
  if (!chaveExisteNoServidor(MATERIAIS_DENTISTA_STORAGE_KEY)) {
    return [...MATERIAIS_DENTISTA_PADRAO];
  }
  const lista = readStorage<string[]>(MATERIAIS_DENTISTA_STORAGE_KEY, []);
  if (!Array.isArray(lista)) return [];
  return lista.map((m) => String(m).trim()).filter(Boolean);
}
