import { STATUS_TRABALHO } from "@/lib/utils";

const ALIASES_STATUS_OS: Record<string, string> = {
  recebido: "pedido",
  processando: "producao",
};

export function normalizarChaveStatusOs(status?: string | null): string {
  const raw = (status ?? "").trim().toLowerCase();
  if (!raw) return "pendente";
  const alias = ALIASES_STATUS_OS[raw];
  if (alias) return alias;
  return raw;
}

export function labelStatusOs(status?: string | null): string {
  const key = normalizarChaveStatusOs(status);
  const meta = STATUS_TRABALHO[key as keyof typeof STATUS_TRABALHO];
  const original = (status ?? "").trim();
  return meta?.label ?? (original || "Pendente");
}

export function metaStatusOs(status?: string | null) {
  const key = normalizarChaveStatusOs(status);
  const meta = STATUS_TRABALHO[key as keyof typeof STATUS_TRABALHO];
  return {
    key,
    label: meta?.label ?? (status?.trim() || "Pendente"),
    color: meta?.color ?? "bg-slate-100 text-slate-700",
  };
}

/** Módulo TV: só exibe OS com situação Produção (etapa atual vem do mapa de etapas). */
export function trabalhoVisivelModuloTv(status?: string | null): boolean {
  return normalizarChaveStatusOs(status) === "producao";
}
