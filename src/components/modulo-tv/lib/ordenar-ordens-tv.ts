import { classificarPrazoTv } from "@/components/modulo-tv/lib/prazo-categoria";
import type { OrdemServicoTv, PrioridadeOs } from "@/components/modulo-tv/types";

/** Topo da coluna: urgente → alta → média (normal) → baixa. */
export function pesoPrioridadeOsTv(prioridade: PrioridadeOs): number {
  switch (prioridade) {
    case "urgente":
      return 0;
    case "alta":
      return 1;
    case "normal":
      return 2;
    case "baixa":
      return 3;
    default:
      return 4;
  }
}

function pesoPrazoColunaTv(ordem: OrdemServicoTv): number {
  const categoria = classificarPrazoTv(ordem);
  if (categoria === "atrasada") return 0;
  if (categoria === "hoje") return 1;
  if (categoria === "amanha") return 2;
  return 3;
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
    const diffPrioridade =
      pesoPrioridadeOsTv(a.prioridade) - pesoPrioridadeOsTv(b.prioridade);
    if (diffPrioridade !== 0) return diffPrioridade;

    const diffPrazo = pesoPrazoColunaTv(a) - pesoPrazoColunaTv(b);
    if (diffPrazo !== 0) return diffPrazo;

    return compararDentroDoGrupo(a, b);
  });
}
