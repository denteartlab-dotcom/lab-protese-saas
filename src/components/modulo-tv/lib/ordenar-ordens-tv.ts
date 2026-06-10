import { classificarPrazoTv } from "@/components/modulo-tv/lib/prazo-categoria";
import type { OrdemServicoTv } from "@/components/modulo-tv/types";

/** Ordem no topo da coluna: urgente → atrasada → hoje → amanhã → após amanhã. */
function prioridadeColunaTv(ordem: OrdemServicoTv): number {
  if (ordem.prioridade === "urgente") return 0;
  const categoria = classificarPrazoTv(ordem);
  if (categoria === "atrasada") return 1;
  if (categoria === "hoje") return 2;
  if (categoria === "amanha") return 3;
  return 4;
}

function compararDentroDoGrupo(a: OrdemServicoTv, b: OrdemServicoTv) {
  const categoriaA = classificarPrazoTv(a);
  const categoriaB = classificarPrazoTv(b);

  if (categoriaA === "atrasada" || categoriaB === "atrasada" || a.atrasada || b.atrasada) {
    return new Date(a.prazoIso).getTime() - new Date(b.prazoIso).getTime();
  }

  const diffPrazo = new Date(a.prazoIso).getTime() - new Date(b.prazoIso).getTime();
  if (diffPrazo !== 0) return diffPrazo;

  return b.numeroOs - a.numeroOs;
}

export function ordenarOrdensColunaTv(ordens: OrdemServicoTv[]): OrdemServicoTv[] {
  return [...ordens].sort((a, b) => {
    const grupoA = prioridadeColunaTv(a);
    const grupoB = prioridadeColunaTv(b);
    if (grupoA !== grupoB) return grupoA - grupoB;
    return compararDentroDoGrupo(a, b);
  });
}
