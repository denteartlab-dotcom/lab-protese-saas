import type { OrdemServicoTv } from "@/components/modulo-tv/types";

/** OS atrasadas no topo da coluna; entre atrasadas, prazo mais antigo primeiro. */
export function ordenarOrdensColunaTv(ordens: OrdemServicoTv[]): OrdemServicoTv[] {
  return [...ordens].sort((a, b) => {
    if (a.atrasada !== b.atrasada) {
      return a.atrasada ? -1 : 1;
    }
    if (a.atrasada && b.atrasada) {
      return new Date(a.prazoIso).getTime() - new Date(b.prazoIso).getTime();
    }
    return b.numeroOs - a.numeroOs;
  });
}
