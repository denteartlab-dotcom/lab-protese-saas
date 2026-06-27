import { valorLinhaInstrucao } from "@/lib/modulo-producao-os";

export type PrioridadeOsForm = "alta" | "media" | "baixa";

export type PrioridadeOsTv = "urgente" | "alta" | "normal" | "baixa";

export const PRIORIDADE_OS_OPCOES: { value: PrioridadeOsForm; label: string }[] = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

export function normalizarPrioridadeOsForm(valor?: string | null): PrioridadeOsForm | "" {
  const texto = (valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (texto === "alta") return "alta";
  if (texto === "media" || texto === "medio") return "media";
  if (texto === "baixa") return "baixa";
  return "";
}

export function parsePrioridadeOsInstrucoes(
  instrucoes?: string | null
): PrioridadeOsForm | "" {
  return normalizarPrioridadeOsForm(valorLinhaInstrucao(instrucoes || "", "Prioridade:"));
}

export function linhaPrioridadeOs(prioridade: PrioridadeOsForm) {
  return `Prioridade: ${prioridade}`;
}

export function prioridadeOsFormParaTv(prioridade: PrioridadeOsForm): PrioridadeOsTv {
  if (prioridade === "alta") return "alta";
  if (prioridade === "baixa") return "baixa";
  return "normal";
}
