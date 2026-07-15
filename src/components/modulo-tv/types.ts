export type PrioridadeOs = "urgente" | "alta" | "normal" | "baixa";

export type ColunaKanbanId =
  | "entrada"
  | "plano_cera"
  | "montagem"
  | "acrilizacao"
  | "acabamento"
  | "pronto_entrega";

export type OrdemServicoTv = {
  id: string;
  numeroOs: number;
  paciente: string;
  dentista: string;
  colaborador: string;
  colaboradorId: string;
  prioridade: PrioridadeOs;
  prazo: string;
  prazoIso: string;
  status: string;
  coluna: ColunaKanbanId;
  atrasada: boolean;
  etapaDesde: string;
};

export type ColaboradorTv = {
  id: string;
  nome: string;
  online: boolean;
};

export type ColunaKanbanConfig = {
  id: ColunaKanbanId;
  label: string;
  dot: string;
  bar: string;
  accent: string;
  glow: string;
  border: string;
  badge: string;
  ring: string;
};

export type TvDashboardStats = {
  totalProducao: number;
  atrasadas: number;
  prazoHoje: number;
  prazoAmanha: number;
  prazoAposAmanha: number;
  entregasHoje: number;
  entregasConcluidas: number;
  colaboradoresOnline: number;
  percentualConcluido: number;
};

export type MaiorAtrasoTv = {
  numeroOs: number;
  dias: number;
};

export type TvChartPoint = {
  timestamp: string;
  label: string;
  entrada: number;
  plano_cera: number;
  montagem: number;
  acrilizacao: number;
  acabamento: number;
  pronto_entrega: number;
  total: number;
};

export type TvOrdensResponse = {
  ordens: OrdemServicoTv[];
  colaboradores: ColaboradorTv[];
  stats: TvDashboardStats;
  ultimaAtualizacao: string;
  /** Presente após mover card no kanban — espelho local do Controle/Módulo. */
  mapaEtapas?: Record<string, number[]>;
  chaveEtapaMovida?: string;
  indiceEtapaMovida?: number;
};

export type TvChartResponse = {
  pontos: TvChartPoint[];
};

export type TvEtapaResumo = {
  indice: number;
  nome: string;
  responsavel: string;
  prazo: string;
  concluida: boolean;
  atual: boolean;
};

export type TvItemResumo = {
  descricao: string;
  qtd: string;
  situacao: string;
};

export type TvOsResumo = {
  id: string;
  numeroOs: number;
  paciente: string;
  dentista: string;
  tipoProtese: string;
  dentes: string;
  cor: string;
  material: string;
  prioridade: PrioridadeOs;
  atrasada: boolean;
  urgente: boolean;
  repeticao: boolean;
  coluna: ColunaKanbanId;
  colunaLabel: string;
  status: string;
  statusOs: string;
  colaborador: string;
  prazo: string;
  dataEntrada: string;
  dataPrevista: string | null;
  observacoes: string;
  itens: TvItemResumo[];
  etapas: TvEtapaResumo[];
};
