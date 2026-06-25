import { STATUS_TRABALHO } from "@/lib/utils";

const ALIASES_STATUS_OS: Record<string, string> = {
  recebido: "pedido",
  processando: "producao",
  "saiu para entrega": "saiu_entrega",
  "saiu-entrega": "saiu_entrega",
  "recebido pelo cliente": "recebido_cliente",
  "recebido cliente": "recebido_cliente",
  "entregue ao cliente": "entregue_cliente",
  "entregue cliente": "entregue_cliente",
};

const ROTULO_PARA_CHAVE_STATUS_OS = Object.fromEntries(
  Object.entries(STATUS_TRABALHO).map(([chave, meta]) => [meta.label.trim().toLowerCase(), chave])
) as Record<string, string>;

export function normalizarChaveStatusOs(status?: string | null): string {
  const original = (status ?? "").trim();
  const raw = original.toLowerCase();
  if (!raw) return "pendente";

  const alias = ALIASES_STATUS_OS[raw];
  if (alias) return alias;

  if (STATUS_TRABALHO[raw]) return raw;

  const porRotulo = ROTULO_PARA_CHAVE_STATUS_OS[raw];
  if (porRotulo) return porRotulo;

  const underscored = raw.replace(/[\s-]+/g, "_");
  if (STATUS_TRABALHO[underscored]) return underscored;

  return underscored;
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
