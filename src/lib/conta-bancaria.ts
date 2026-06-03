import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

export type AcaoContaBancaria = "movimentar" | "baixar" | "adicionar_credito";

export type TipoChavePix = "" | "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export type ModoVinculoConta = "manual" | "open_finance" | "extrato_arquivo";

export type VinculoOpenFinance = {
  provedor: "pluggy";
  itemId: string;
  conectadoEm: string;
  ultimaSync?: string;
  status: "conectado" | "erro" | "sincronizando";
  mensagemErro?: string;
};

export type ContaBancaria = {
  id: string;
  nome: string;
  saldoInicial: number;
  excluida?: boolean;
  acaoPrincipal: AcaoContaBancaria;
  codBanco?: string;
  agencia?: string;
  numeroConta?: string;
  tipoChavePix?: TipoChavePix;
  chavePix?: string;
  modoVinculo?: ModoVinculoConta;
  openFinance?: VinculoOpenFinance;
};

export type DadosFormContaBancaria = {
  nome: string;
  codBanco: string;
  agencia: string;
  numeroConta: string;
  tipoChavePix: TipoChavePix;
  chavePix: string;
  saldoInicial: string;
  modoVinculo: ModoVinculoConta;
  /** Preenchido após conexão Open Finance (Pluggy itemId). */
  openFinanceItemId?: string;
};

export function contaFromFormEdicao(
  dados: DadosFormContaBancaria,
  anterior: ContaBancaria
): ContaBancaria {
  const base = contaFromForm(dados, anterior.id);
  return {
    ...base,
    acaoPrincipal: anterior.acaoPrincipal,
    excluida: anterior.excluida,
    modoVinculo: dados.modoVinculo,
    openFinance:
      dados.modoVinculo === "open_finance" && dados.openFinanceItemId
        ? {
            provedor: "pluggy",
            itemId: dados.openFinanceItemId,
            conectadoEm:
              anterior.openFinance?.conectadoEm ?? new Date().toISOString(),
            ultimaSync: anterior.openFinance?.ultimaSync,
            status: "conectado",
          }
        : dados.modoVinculo === "open_finance"
          ? anterior.openFinance
          : undefined,
  };
}

export function contaFromForm(
  dados: DadosFormContaBancaria,
  id?: string
): ContaBancaria {
  const saldo = Number(
    dados.saldoInicial.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  );
  return {
    id: id ?? `cb-${Date.now()}`,
    nome: dados.nome.trim(),
    saldoInicial: Number.isFinite(saldo) ? saldo : 0,
    acaoPrincipal: "movimentar",
    codBanco: dados.codBanco.trim(),
    agencia: dados.agencia.trim(),
    numeroConta: dados.numeroConta.trim(),
    tipoChavePix: dados.tipoChavePix,
    chavePix: dados.chavePix.trim(),
    modoVinculo: dados.modoVinculo,
    openFinance: dados.openFinanceItemId
      ? {
          provedor: "pluggy",
          itemId: dados.openFinanceItemId,
          conectadoEm: new Date().toISOString(),
          status: "conectado",
        }
      : undefined,
  };
}

export function formFromConta(conta: ContaBancaria): DadosFormContaBancaria {
  return {
    nome: conta.nome,
    codBanco: conta.codBanco ?? "",
    agencia: conta.agencia ?? "",
    numeroConta: conta.numeroConta ?? "",
    tipoChavePix: conta.tipoChavePix ?? "",
    chavePix: conta.chavePix ?? "",
    saldoInicial: conta.saldoInicial.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    modoVinculo: conta.modoVinculo ?? "manual",
    openFinanceItemId: conta.openFinance?.itemId,
  };
}

export const FORM_CONTA_BANCARIA_VAZIO: DadosFormContaBancaria = {
  nome: "",
  codBanco: "",
  agencia: "",
  numeroConta: "",
  tipoChavePix: "",
  chavePix: "",
  saldoInicial: "0,00",
  modoVinculo: "manual",
  openFinanceItemId: undefined,
};

export type MovimentacaoContaBancaria = {
  id: string;
  contaId: string;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  data: string;
};

export const CONTAS_BANCARIAS_STORAGE_KEY = "labProteseContasBancarias";
export const MOVIMENTACOES_CONTA_STORAGE_KEY = "labProteseMovimentacoesConta";
export const CONTAS_BANCARIAS_VERSION_KEY = "labProteseContasBancariasVersion";
export const CONTAS_BANCARIAS_VERSION = 3;

/** Saldo de demonstração legado — zerado na migração v3. */
const SALDO_INICIAL_DEMO_LEGADO = 18215.6;

export const CONTAS_BANCARIAS_PADRAO: ContaBancaria[] = [
  {
    id: "cb-caixa",
    nome: "Caixa Principal",
    saldoInicial: 0,
    acaoPrincipal: "movimentar",
  },
  {
    id: "cb-carteira",
    nome: "Carteira Digital",
    saldoInicial: 0,
    acaoPrincipal: "baixar",
  },
  {
    id: "cb-nf",
    nome: "Nota Fiscal",
    saldoInicial: 0,
    acaoPrincipal: "adicionar_credito",
  },
];

type LancamentoResumo = {
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
};

function normalizarSaldoLegado(contas: ContaBancaria[]): ContaBancaria[] {
  return contas.map((c) => {
    if (
      c.id === "cb-caixa" &&
      Math.abs(c.saldoInicial - SALDO_INICIAL_DEMO_LEGADO) < 0.01
    ) {
      return { ...c, saldoInicial: 0 };
    }
    return c;
  });
}

export function carregarContasBancarias(): ContaBancaria[] {
  if (typeof window === "undefined") return CONTAS_BANCARIAS_PADRAO;
  try {
    const versao = readStorage<string | null>(CONTAS_BANCARIAS_VERSION_KEY, null);
    const existente = readStorage<ContaBancaria[] | null>(CONTAS_BANCARIAS_STORAGE_KEY, null);

    if (versao !== String(CONTAS_BANCARIAS_VERSION)) {
      let contas =
        Array.isArray(existente) && existente.length > 0 ? existente : CONTAS_BANCARIAS_PADRAO;
      contas = normalizarSaldoLegado(contas);
      salvarContasBancarias(contas);
      return contas;
    }

    if (!Array.isArray(existente) || existente.length === 0) return CONTAS_BANCARIAS_PADRAO;
    return normalizarSaldoLegado(existente);
  } catch {
    return CONTAS_BANCARIAS_PADRAO;
  }
}

export function salvarContasBancarias(contas: ContaBancaria[]) {
  if (typeof window === "undefined") return;
  writeStorage(CONTAS_BANCARIAS_STORAGE_KEY, contas);
  writeStorage(CONTAS_BANCARIAS_VERSION_KEY, String(CONTAS_BANCARIAS_VERSION));
}

export function carregarMovimentacoesConta(): MovimentacaoContaBancaria[] {
  if (typeof window === "undefined") return [];
  const parsed = readStorage<MovimentacaoContaBancaria[] | null>(
    MOVIMENTACOES_CONTA_STORAGE_KEY,
    null
  );
  return Array.isArray(parsed) ? parsed : [];
}

export function salvarMovimentacoesConta(movs: MovimentacaoContaBancaria[]) {
  if (typeof window === "undefined") return;
  writeStorage(MOVIMENTACOES_CONTA_STORAGE_KEY, movs);
}

export function contaDeLancamento(
  lancamento: LancamentoResumo,
  nomePadrao = "Caixa Principal"
): string {
  if (lancamento.tipo === "despesa") {
    return desempacotarDespesa(lancamento.descricao).conta || nomePadrao;
  }
  return nomePadrao;
}

export function calcularSaldoConta(
  conta: ContaBancaria,
  lancamentos: LancamentoResumo[],
  movimentacoes: MovimentacaoContaBancaria[]
) {
  let saldo = conta.saldoInicial;

  for (const l of lancamentos) {
    if (l.status !== "pago") continue;
    const contaRef = contaDeLancamento(l, "Caixa Principal");
    if (contaRef !== conta.nome) continue;
    if (l.tipo === "receita") saldo += l.valor;
    else saldo -= l.valor;
  }

  for (const m of movimentacoes) {
    if (m.contaId !== conta.id) continue;
    if (m.tipo === "entrada") saldo += m.valor;
    else saldo -= m.valor;
  }

  return saldo;
}

export function labelAcaoConta(acao: AcaoContaBancaria) {
  if (acao === "movimentar") return "movimentar";
  if (acao === "baixar") return "baixar";
  return "Adicionar crédito";
}
