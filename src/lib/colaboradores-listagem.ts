import { diaPagamentoComissaoNormalizado } from "@/lib/comissao-colaboradores-pagamento";
import { readStorage } from "@/lib/persisted-storage";

export const COLABORADORES_STORAGE_KEY = "labProteseColaboradores";
export const COLABORADORES_EXCLUIDOS_STORAGE_KEY = "labProteseColaboradoresExcluidos";
export const COLABORADORES_ATUALIZADOS_EVENT = "lab-colaboradores-atualizados";

export type ColaboradorListagem = {
  id: string;
  nome: string;
  comissaoPercentual: string;
  comissaoRepeticao: string;
  padraoComissao: string;
  tipoContratacao: string;
  tipoValorComissao: string;
  tipoValorComissaoRepeticao: string;
  diaPagamentoComissao: number;
};

type ColaboradorStorage = {
  id: string;
  nome: string;
  comissaoPercentual?: string;
  dados?: {
    tipoContratacao?: string;
    valorComissao?: string;
    comissaoRepeticao?: string;
    descricaoComissao?: string;
    tipoValorComissao?: string;
    tipoValorComissaoRepeticao?: string;
    diaPagamentoComissao?: string;
  };
};

const colaboradoresPadrao: ColaboradorStorage[] = [];

function normalizarColaborador(colaborador: ColaboradorStorage): ColaboradorListagem | null {
  const nome = colaborador.nome?.trim();
  if (!nome) return null;

  const dados = colaborador.dados || {};
  const padraoRaw = String(dados.descricaoComissao || "Não");
  const padraoComissao = padraoRaw.toLowerCase().startsWith("s") ? "Sim" : "Nao";

  return {
    id: colaborador.id || nome,
    nome,
    comissaoPercentual: colaborador.comissaoPercentual || dados.valorComissao || "0,00",
    comissaoRepeticao: dados.comissaoRepeticao || "0,00",
    padraoComissao,
    tipoContratacao: dados.tipoContratacao || "Salário + Comissão",
    tipoValorComissao: dados.tipoValorComissao || "%",
    tipoValorComissaoRepeticao: dados.tipoValorComissaoRepeticao || "%",
    diaPagamentoComissao: diaPagamentoComissaoNormalizado(dados.diaPagamentoComissao),
  };
}

function normalizarNomeColaborador(nome: string) {
  return nome.trim().toLocaleLowerCase("pt-BR");
}

export function notificarColaboradoresAtualizados() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COLABORADORES_ATUALIZADOS_EVENT));
}

export function carregarColaboradoresExcluidos(): Array<{ id?: string; nome?: string }> {
  const lista = readStorage<Array<{ id?: string; nome?: string }>>(
    COLABORADORES_EXCLUIDOS_STORAGE_KEY,
    []
  );
  return Array.isArray(lista) ? lista : [];
}

/** Compara id ou nome com a lista de excluídos (vale no navegador e no servidor). */
export function colaboradorEstaNaListaExcluidos(
  ref: { id?: string; nome?: string },
  excluidos: ReadonlyArray<{ id?: string; nome?: string }>
) {
  const id = ref.id?.trim();
  const nome = normalizarNomeColaborador(ref.nome || "");
  if (!id && !nome) return false;
  return excluidos.some((item) => {
    if (id && item.id && item.id === id) return true;
    const nomeItem = normalizarNomeColaborador(item.nome || "");
    return Boolean(nome && nomeItem && nome === nomeItem);
  });
}

/** Cadastro movido para excluídos não pode ser escolhido em nenhum seletor. */
export function colaboradorEstaExcluido(ref: { id?: string; nome?: string }) {
  return colaboradorEstaNaListaExcluidos(ref, carregarColaboradoresExcluidos());
}

export function filtrarNomesColaboradoresSelecionaveis(nomes: Iterable<string>) {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const nome of nomes) {
    const limpo = nome.trim();
    if (!limpo || colaboradorEstaExcluido({ nome: limpo })) continue;
    const chave = normalizarNomeColaborador(limpo);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(limpo);
  }
  return saida;
}

/** Lista colaboradores ativos do cadastro, ordenados por nome. */
export function carregarColaboradoresListagem(): ColaboradorListagem[] {
  const lista = readStorage<ColaboradorStorage[]>(COLABORADORES_STORAGE_KEY, colaboradoresPadrao);
  return colaboradoresListagemFromStorage(lista).filter((item) => !colaboradorEstaExcluido(item));
}

export function colaboradoresListagemFromStorage(
  lista: ColaboradorStorage[]
): ColaboradorListagem[] {
  return lista
    .map(normalizarColaborador)
    .filter((item): item is ColaboradorListagem => item !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
