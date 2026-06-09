export type PrioridadeOs = "urgente" | "alta" | "normal" | "baixa";

export type ColunaKanbanId =
  | "recebido"
  | "escaneamento"
  | "design"
  | "impressao"
  | "acabamento"
  | "pronto";

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
  entregasHoje: number;
  colaboradoresOnline: number;
  percentualConcluido: number;
};

export type TvChartPoint = {
  timestamp: string;
  label: string;
  recebido: number;
  escaneamento: number;
  design: number;
  impressao: number;
  acabamento: number;
  pronto: number;
  total: number;
};

export type TvOrdensResponse = {
  ordens: OrdemServicoTv[];
  colaboradores: ColaboradorTv[];
  stats: TvDashboardStats;
  ultimaAtualizacao: string;
};

export type TvChartResponse = {
  pontos: TvChartPoint[];
};
