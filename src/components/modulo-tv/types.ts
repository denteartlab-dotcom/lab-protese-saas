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
  prioridade: PrioridadeOs;
  prazo: string;
  prazoIso: string;
  status: string;
  coluna: ColunaKanbanId;
  atrasada: boolean;
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
