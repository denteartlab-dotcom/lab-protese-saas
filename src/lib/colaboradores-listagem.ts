import { readStorage } from "@/lib/persisted-storage";

export const COLABORADORES_STORAGE_KEY = "labProteseColaboradores";

export type ColaboradorListagem = {
  id: string;
  nome: string;
  comissaoPercentual: string;
  comissaoRepeticao: string;
  padraoComissao: string;
  tipoContratacao: string;
  tipoValorComissao: string;
  tipoValorComissaoRepeticao: string;
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
  };
}

/** Lista colaboradores do cadastro (banco), ordenados por nome. */
export function carregarColaboradoresListagem(): ColaboradorListagem[] {
  const lista = readStorage<ColaboradorStorage[]>(COLABORADORES_STORAGE_KEY, colaboradoresPadrao);
  return lista
    .map(normalizarColaborador)
    .filter((item): item is ColaboradorListagem => item !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
