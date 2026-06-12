export type PeriodoClientesPrejuizo =
  | "30dias"
  | "90dias"
  | "mes_atual"
  | "personalizado";

export type StatusCriticidadeCliente = "alto" | "medio" | "baixo";

export type ClienteRetornoServico = {
  cliente: string;
  retrabalhos: number;
  garantias: number;
  status: StatusCriticidadeCliente;
};

export type ClienteRepeteEtapas = {
  cliente: string;
  servicosComRepeticao: number;
  totalRepeticoes: number;
  etapaMaisRepetida: string;
  status: StatusCriticidadeCliente;
};

export type ClienteTempoAprovacao = {
  cliente: string;
  tempoMedioDias: number;
};

export type ClienteDevolucao = {
  cliente: string;
  devolucoes: number;
};

export type MotivoFrequente = {
  motivo: string;
  quantidade: number;
};

export type PrejuizoCliente = {
  cliente: string;
  valor: number;
};

export type AlertaGargalo = {
  cliente: string;
  nivel: "alto" | "medio";
  itens: string[];
};

export type RepeticoesResumo = {
  totalRepeticoes: number;
  servicosComRetrabalho: number;
  etapaMaisRepetida: string;
  clienteMaisCritico: string;
};

export type GraficoBarraRepeticao = {
  nome: string;
  valor: number;
};

export type ResumoClientesPrejuizo = {
  retrabalhos: number;
  garantias: number;
  clientesCriticos: number;
  prejuizoEstimado: number;
};

export type RelatorioClientesPrejuizoPayload = {
  resumo: ResumoClientesPrejuizo;
  repeticoesResumo: RepeticoesResumo;
  clientesRetorno: ClienteRetornoServico[];
  clientesRepetemEtapas: ClienteRepeteEtapas[];
  clientesAprovacao: ClienteTempoAprovacao[];
  clientesDevolucao: ClienteDevolucao[];
  motivosFrequentes: MotivoFrequente[];
  prejuizoPorCliente: PrejuizoCliente[];
  alertasGargalos: AlertaGargalo[];
  graficoTop10Clientes: GraficoBarraRepeticao[];
  graficoEtapasRepetidas: GraficoBarraRepeticao[];
  geradoEm: string;
  periodoLabel: string;
};

export const OPCOES_PERIODO_CLIENTES_PREJUIZO: {
  value: PeriodoClientesPrejuizo;
  label: string;
}[] = [
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "90dias", label: "Últimos 90 dias" },
  { value: "mes_atual", label: "Este mês" },
  { value: "personalizado", label: "Personalizado" },
];

export function formatarMoedaClientesPrejuizo(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function labelStatusCriticidade(status: StatusCriticidadeCliente) {
  if (status === "alto") return "Alto";
  if (status === "medio") return "Médio";
  return "Baixo";
}

export function statusCriticidadeRepeticoes(totalRepeticoes: number): StatusCriticidadeCliente {
  if (totalRepeticoes > 10) return "alto";
  if (totalRepeticoes >= 4) return "medio";
  return "baixo";
}
