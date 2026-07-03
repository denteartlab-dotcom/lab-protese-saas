import type { ColaboradorListagem } from "@/lib/colaboradores-listagem";
import type { ConfiguracoesGerais } from "@/lib/configuracoes-gerais";
import type { EtapaCadastro } from "@/lib/etapas-os";
import type { SetorCadastro } from "@/lib/setores-cadastro";
import type { CategoriaTabelaPrecoOs } from "@/lib/tabela-precos-os";

export type TrabalhoContextoClienteResumo = {
  id: string;
  nome: string;
  observacoes: string | null;
  representanteColaboradorId: string | null;
};

export type TrabalhoContextoPacienteResumo = {
  id: string;
  nome: string;
  clienteId: string;
};

export type TrabalhoContextoLancamentoReceita = {
  id: string;
  tipo: string;
  status: string;
  valor: number;
  data: string;
  clienteId: string | null;
  descricao: string;
  cliente?: { id: string; nome: string } | null;
  trabalho?: { id: string; numeroOs: number } | null;
};

export type TrabalhoContextoProdutoResumo = {
  id: string;
  nome: string;
  categoria: string | null;
  valor: number;
};

export type TrabalhoContextoTabelaPrecos = {
  tabela: string;
  tabelas: string[];
  categoriasPorTabela: Record<string, CategoriaTabelaPrecoOs[]>;
};

export type TrabalhoContextoTrabalhoEdicao = {
  id: string;
  numeroOs: number;
  segmentoFaturamento: string;
  grupoOsId: string | null;
  clienteId: string;
  pacienteId: string | null;
  tipoProtese: string;
  dentes: string | null;
  cor: string | null;
  material: string | null;
  escala: string | null;
  dataEntrada: string;
  dataPrevista: string | null;
  dataEntrega: string | null;
  valor: number;
  status: string;
  observacoes: string | null;
  instrucoes: string | null;
  cliente?: {
    observacoes?: string | null;
    nome?: string;
  } | null;
  paciente?: { nome?: string | null } | null;
  grupo?: TrabalhoContextoTrabalhoEdicao[];
};

export type TrabalhoContextoResponse = {
  proximoNumeroOs: number;
  clientes: TrabalhoContextoClienteResumo[];
  lancamentosReceita: TrabalhoContextoLancamentoReceita[];
  produtos: TrabalhoContextoProdutoResumo[];
  etapas: EtapaCadastro[];
  setores: SetorCadastro[];
  colaboradores: ColaboradorListagem[];
  tabelaPrecos: TrabalhoContextoTabelaPrecos;
  configuracoesGerais: ConfiguracoesGerais;
  pacientes?: TrabalhoContextoPacienteResumo[];
  trabalho?: TrabalhoContextoTrabalhoEdicao;
};
