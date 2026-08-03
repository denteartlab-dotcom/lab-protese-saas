import { normalizarChaveStatusOs } from "@/lib/status-os";
import { grupoOsIdOf } from "@/lib/trabalho-os-segmento";

/** Chave estável da OS para o mapa de início de produção (sem I/O). */
export function chaveInicioProducaoOs(trabalho: {
  id: string;
  grupoOsId?: string | null;
}) {
  return grupoOsIdOf(trabalho);
}

export function interpretarInicioProducaoOs(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function statusContaTempoProducao(status?: string | null) {
  return normalizarChaveStatusOs(status) === "producao";
}
