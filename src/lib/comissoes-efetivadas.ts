import { persistirArmazenamentoImediato, readStorage, writeStorage } from "@/lib/persisted-storage";
import { referenciaDespesaComissaoColaborador } from "@/lib/comissao-colaboradores-pagamento";

export const COMISSOES_EFETIVADAS_STORAGE_KEY = "labProteseComissoesEfetivadas";

export type ComissaoEfetivadaRegistro = {
  colaborador: string;
  mesCompetencia: string;
  valor: number;
  numeroOs: number;
  efetivadoEm: string;
};

export type DespesaComissaoRef = {
  id: string;
  status?: string;
};

export type ComissoesEfetivadasStore = {
  linhas: Record<string, ComissaoEfetivadaRegistro>;
  despesas: Record<string, DespesaComissaoRef>;
};

const VAZIO: ComissoesEfetivadasStore = { linhas: {}, despesas: {} };

export function storeComissoesEfetivadasVazio(): ComissoesEfetivadasStore {
  return { linhas: {}, despesas: {} };
}

export function lerComissoesEfetivadas(): ComissoesEfetivadasStore {
  const raw = readStorage<Partial<ComissoesEfetivadasStore>>(COMISSOES_EFETIVADAS_STORAGE_KEY, VAZIO);
  return {
    linhas: raw.linhas && typeof raw.linhas === "object" ? raw.linhas : {},
    despesas: raw.despesas && typeof raw.despesas === "object" ? raw.despesas : {},
  };
}

export function salvarComissoesEfetivadas(store: ComissoesEfetivadasStore) {
  writeStorage(COMISSOES_EFETIVADAS_STORAGE_KEY, store);
  void persistirArmazenamentoImediato(COMISSOES_EFETIVADAS_STORAGE_KEY, store);
}

export function chaveDespesaComissaoStore(colaborador: string, mesCompetencia: string) {
  return referenciaDespesaComissaoColaborador(colaborador, mesCompetencia);
}

export function linhaComissaoEfetivada(
  store: ComissoesEfetivadasStore,
  linhaId: string
): boolean {
  return Boolean(store.linhas[linhaId]);
}

export function totalEfetivadoColaboradorMes(
  store: ComissoesEfetivadasStore,
  colaborador: string,
  mesCompetencia: string
) {
  const nome = colaborador.trim().toLowerCase();
  return Object.values(store.linhas).reduce((soma, item) => {
    if (item.colaborador.trim().toLowerCase() !== nome) return soma;
    if (item.mesCompetencia !== mesCompetencia) return soma;
    return soma + (Number(item.valor) || 0);
  }, 0);
}

export function marcarLinhaComissaoEfetivada(
  store: ComissoesEfetivadasStore,
  linhaId: string,
  registro: ComissaoEfetivadaRegistro
): ComissoesEfetivadasStore {
  return {
    ...store,
    linhas: { ...store.linhas, [linhaId]: registro },
  };
}

export function desmarcarLinhaComissaoEfetivada(
  store: ComissoesEfetivadasStore,
  linhaId: string
): ComissoesEfetivadasStore {
  const linhas = { ...store.linhas };
  delete linhas[linhaId];
  return { ...store, linhas };
}

export function registrarDespesaComissaoStore(
  store: ComissoesEfetivadasStore,
  colaborador: string,
  mesCompetencia: string,
  despesa: DespesaComissaoRef
): ComissoesEfetivadasStore {
  return {
    ...store,
    despesas: {
      ...store.despesas,
      [chaveDespesaComissaoStore(colaborador, mesCompetencia)]: despesa,
    },
  };
}

export function removerDespesaComissaoStore(
  store: ComissoesEfetivadasStore,
  colaborador: string,
  mesCompetencia: string
): ComissoesEfetivadasStore {
  const despesas = { ...store.despesas };
  delete despesas[chaveDespesaComissaoStore(colaborador, mesCompetencia)];
  return { ...store, despesas };
}
