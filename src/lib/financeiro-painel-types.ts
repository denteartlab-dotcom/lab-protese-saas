import type { ItemPlanoContas } from "@/lib/plano-contas";
import type { ContaBancaria, MovimentacaoContaBancaria } from "@/lib/conta-bancaria";
import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";
import type { Prisma } from "@prisma/client";

/** Converte campos Date do Prisma em string ISO para JSON/API. */
export type SerializeDates<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? SerializeDates<U>[]
    : T extends object
      ? { [K in keyof T]: SerializeDates<T[K]> }
      : T;

export type MovimentacaoExtratoPainel = {
  id: string;
  date: string;
  type: string;
  value: number;
  description: string;
  balance: number;
};

export type ResumoFinanceiroPainel = {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  receitasPendentes: number;
  despesasPendentes: number;
};

export type LancamentoFinanceiroPainel = SerializeDates<
  Prisma.LancamentoGetPayload<{
    include: {
      cliente: { select: { id: true; nome: true } };
      trabalho: { select: { id: true; numeroOs: true } };
    };
  }>
> & {
  cobrancaAsaas?: {
    id: string;
    bankSlipUrl?: string | null;
    invoiceUrl?: string | null;
    linhaDigitavel?: string | null;
    statusAsaas?: string;
  } | null;
};

export type TrabalhoPainelReceita = SerializeDates<
  Prisma.TrabalhoGetPayload<{
    include: {
      cliente: { select: { id: true; nome: true; cro: true } };
      paciente: { select: { id: true; nome: true } };
    };
  }>
>;

export type DespesaPainelFinanceiro = LancamentoFinanceiroPainel;

export type SubcontaDigitalPublica = {
  status: string;
  statusGeral?: string | null;
  statusDocumentacao?: string | null;
  asaasAccountId?: string | null;
  walletId?: string | null;
  agencia?: string | null;
  conta?: string | null;
  contaDigito?: string | null;
  contaAtiva?: boolean;
  contaMaeConfigurada?: boolean;
  modoIntegracao?: "subconta" | "legado" | null;
  integracaoConfigurada?: boolean;
  podeUsarIntegracaoManual?: boolean;
  subcontaIniciada?: boolean;
  podeVisualizarContaDigital?: boolean;
};

export type PainelFinanceiroReceita = {
  aba: "receita";
  lancamentos: LancamentoFinanceiroPainel[];
  resumo: ResumoFinanceiroPainel;
  clientes: Array<{
    id: string;
    nome: string;
    cro: string | null;
    celular: string | null;
    telefone: string | null;
    email: string | null;
  }>;
  trabalhos: TrabalhoPainelReceita[];
};

export type PainelFinanceiroDespesa = {
  aba: "despesa";
  lancamentos: DespesaPainelFinanceiro[];
  resumo: ResumoFinanceiroPainel;
  clientes: Array<{ id: string; nome: string }>;
};

export type PainelFinanceiroBoletos = {
  aba: "boletos";
  lancamentos: DespesaPainelFinanceiro[];
  resumo: ResumoFinanceiroPainel;
};

export type PainelFinanceiroPlanoContas = {
  aba: "plano-de-contas";
  itens: ItemPlanoContas[];
  versao: number;
};

export type PainelFinanceiroContaBancaria = {
  aba: "conta-bancaria";
  contas: ContaBancaria[];
  movimentacoes: MovimentacaoContaBancaria[];
  extrato: ExtratoMovimentacao[];
  lancamentos: LancamentoFinanceiroPainel[];
};

export type ResumoLimitePixPainel = {
  ativo: boolean;
  limiteDiario: number | null;
  usadoHoje: number;
  disponivelHoje: number | null;
};

export type PainelFinanceiroContaDigital = {
  aba: "conta-digital";
  subconta: SubcontaDigitalPublica;
  saldo: number;
  movimentacoes: MovimentacaoExtratoPainel[];
  limitePix: ResumoLimitePixPainel;
};

export type PainelFinanceiroAba =
  | PainelFinanceiroReceita
  | PainelFinanceiroDespesa
  | PainelFinanceiroBoletos
  | PainelFinanceiroPlanoContas
  | PainelFinanceiroContaBancaria
  | PainelFinanceiroContaDigital;

export type AbaPainelFinanceiro = PainelFinanceiroAba["aba"];

export const ABAS_PAINEL_FINANCEIRO = [
  "receita",
  "despesa",
  "boletos",
  "plano-de-contas",
  "conta-bancaria",
  "conta-digital",
] as const satisfies readonly AbaPainelFinanceiro[];
