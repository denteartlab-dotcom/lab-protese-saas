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

export type ResumoClientesPrejuizo = {
  retrabalhos: number;
  garantias: number;
  clientesCriticos: number;
  prejuizoEstimado: number;
};

export type RelatorioClientesPrejuizoPayload = {
  resumo: ResumoClientesPrejuizo;
  clientesRetorno: ClienteRetornoServico[];
  clientesAprovacao: ClienteTempoAprovacao[];
  clientesDevolucao: ClienteDevolucao[];
  motivosFrequentes: MotivoFrequente[];
  prejuizoPorCliente: PrejuizoCliente[];
  alertasGargalos: AlertaGargalo[];
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

const MOCK_BASE: Omit<RelatorioClientesPrejuizoPayload, "geradoEm" | "periodoLabel"> = {
  resumo: {
    retrabalhos: 87,
    garantias: 24,
    clientesCriticos: 15,
    prejuizoEstimado: 3450,
  },
  clientesRetorno: [
    { cliente: "Clínica Sorriso", retrabalhos: 18, garantias: 6, status: "alto" },
    { cliente: "Dr. João", retrabalhos: 12, garantias: 4, status: "alto" },
    { cliente: "Odonto Prime", retrabalhos: 9, garantias: 3, status: "medio" },
    { cliente: "Dra. Marina", retrabalhos: 7, garantias: 2, status: "medio" },
    { cliente: "Lab Dental Center", retrabalhos: 5, garantias: 1, status: "baixo" },
  ],
  clientesAprovacao: [
    { cliente: "Clínica Sorriso", tempoMedioDias: 12 },
    { cliente: "Dr. João", tempoMedioDias: 9 },
    { cliente: "Odonto Prime", tempoMedioDias: 8 },
    { cliente: "Dra. Marina", tempoMedioDias: 7 },
    { cliente: "Lab Dental Center", tempoMedioDias: 5 },
  ],
  clientesDevolucao: [
    { cliente: "Dr. João", devolucoes: 11 },
    { cliente: "Clínica Sorriso", devolucoes: 9 },
    { cliente: "Odonto Prime", devolucoes: 6 },
    { cliente: "Dra. Marina", devolucoes: 4 },
    { cliente: "Lab Dental Center", devolucoes: 2 },
  ],
  motivosFrequentes: [
    { motivo: "Ajuste oclusal", quantidade: 32 },
    { motivo: "Cor incorreta", quantidade: 21 },
    { motivo: "Moldagem ruim", quantidade: 14 },
    { motivo: "Mordida incorreta", quantidade: 9 },
    { motivo: "Outros", quantidade: 11 },
  ],
  prejuizoPorCliente: [
    { cliente: "Clínica Sorriso", valor: 1250 },
    { cliente: "Dr. João", valor: 890 },
    { cliente: "Odonto Prime", valor: 620 },
    { cliente: "Dra. Marina", valor: 410 },
    { cliente: "Lab Dental Center", valor: 280 },
  ],
  alertasGargalos: [
    {
      cliente: "Clínica Sorriso",
      nivel: "alto",
      itens: [
        "Maior número de retrabalhos",
        "Maior tempo de aprovação",
        "Maior custo para o laboratório",
      ],
    },
    {
      cliente: "Dr. João",
      nivel: "medio",
      itens: ["Muitas devoluções", "Aumento de ocorrências nos últimos 30 dias"],
    },
  ],
};

function labelPeriodo(periodo: PeriodoClientesPrejuizo, dataInicio?: string, dataFim?: string) {
  const op = OPCOES_PERIODO_CLIENTES_PREJUIZO.find((o) => o.value === periodo);
  if (periodo === "personalizado" && dataInicio && dataFim) {
    return `${dataInicio} — ${dataFim}`;
  }
  return op?.label ?? "Período";
}

/** Dados mockados — substituir por agregação real quando API estiver pronta. */
export function obterRelatorioClientesPrejuizoMock(opts?: {
  periodo?: PeriodoClientesPrejuizo;
  dataInicio?: string;
  dataFim?: string;
}): RelatorioClientesPrejuizoPayload {
  const periodo = opts?.periodo ?? "30dias";
  const agora = new Date();
  return {
    ...MOCK_BASE,
    periodoLabel: labelPeriodo(periodo, opts?.dataInicio, opts?.dataFim),
    geradoEm: agora.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

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
