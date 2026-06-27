import type { ColunaKanbanId } from "@/components/modulo-tv/types";

function normalizarTexto(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Regras de coluna fixa no kanban da TV por nome do serviço (tipoProtese). */
const COLUNA_POR_SERVICO: Array<{
  teste: (nomeNormalizado: string) => boolean;
  coluna: ColunaKanbanId;
}> = [
  {
    teste: (nome) =>
      nome.includes("placa") &&
      /mior?relax|miorelax|mio relax/.test(nome),
    coluna: "acrilizacao",
  },
];

/** Coluna do kanban TV para serviços com roteamento fixo; null se seguir etapas/status. */
export function colunaTvPorNomeServico(tipoProtese: string): ColunaKanbanId | null {
  const nome = normalizarTexto(tipoProtese);
  if (!nome) return null;
  for (const regra of COLUNA_POR_SERVICO) {
    if (regra.teste(nome)) return regra.coluna;
  }
  return null;
}
