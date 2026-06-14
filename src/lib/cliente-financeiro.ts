/** Extrai valor de linha em observações do cliente (ex.: "Limite Saldo Devedor: 1.000,00"). */
export function configValueFromObservacoes(
  observacoes: string | null | undefined,
  prefix: string
): string {
  if (!observacoes) return "";
  const linhas = observacoes
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.toLowerCase().startsWith(prefix.toLowerCase()));
  const line = linhas[linhas.length - 1];
  if (!line) return "";
  return line.slice(prefix.length).trim();
}

export function parseCurrencyBr(value: string): number {
  const limpo = (value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

export function limiteSaldoDevedorCliente(observacoes: string | null | undefined): number {
  const texto = configValueFromObservacoes(observacoes, "Limite Saldo Devedor:");
  return parseCurrencyBr(texto || "0");
}

/** Dia do mês (1–31) configurado em Cliente → Configuração → Dia da Cobrança. */
export function diaCobrancaCliente(observacoes: string | null | undefined): number | null {
  const texto = configValueFromObservacoes(observacoes, "Dia da Cobrança:");
  const dia = Number.parseInt(texto.replace(/\D/g, ""), 10);
  if (!Number.isFinite(dia) || dia < 1 || dia > 31) return null;
  return dia;
}

/** Hoje é o dia de cobrança do cliente (ou último dia do mês se o dia não existir, ex.: 31 em fevereiro). */
export function ehDiaCobrancaHoje(diaCobranca: number, ref = new Date()): boolean {
  const hoje = ref.getDate();
  const ultimoDiaMes = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  if (hoje === diaCobranca) return true;
  if (diaCobranca > ultimoDiaMes && hoje === ultimoDiaMes) return true;
  return false;
}

export type LancamentoResumo = {
  tipo: string;
  status: string;
  valor: number;
  data: Date | string;
  clienteId?: string | null;
  descricao: string;
  trabalho?: { numeroOs?: number | null } | null;
};

export function saldoDevedorCliente(
  clienteId: string,
  lancamentos: LancamentoResumo[]
): number {
  return lancamentos
    .filter(
      (l) =>
        l.tipo === "receita" &&
        l.status === "pendente" &&
        l.clienteId === clienteId
    )
    .reduce((s, l) => s + l.valor, 0);
}

export function diasDesde(data: Date | string): number {
  const d = typeof data === "string" ? new Date(data) : data;
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const ref = new Date(d);
  ref.setHours(12, 0, 0, 0);
  return Math.floor((hoje.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

export const DIAS_BLOQUEIO_OS_SALDO_DEVEDOR = 30;

/** Maior atraso (em dias) entre receitas pendentes do cliente. */
export function diasAtrasoSaldoDevedorCliente(
  clienteId: string,
  lancamentos: LancamentoResumo[]
): number {
  const pendentes = lancamentos.filter(
    (l) =>
      l.tipo === "receita" &&
      l.status === "pendente" &&
      l.clienteId === clienteId
  );
  if (pendentes.length === 0) return 0;
  return Math.max(...pendentes.map((l) => diasDesde(l.data)));
}

export type BloqueioSaldoDevedorOs = {
  bloqueado: boolean;
  saldo: number;
  limite: number;
  diasAtraso: number;
};

/** Bloqueia nova OS quando o limite de saldo devedor foi atingido e há títulos com mais de 30 dias. */
export function clienteBloqueadoNovaOsPorSaldoDevedor(
  clienteId: string,
  lancamentos: LancamentoResumo[],
  observacoes?: string | null
): BloqueioSaldoDevedorOs {
  const limite = limiteSaldoDevedorCliente(observacoes);
  const saldo = saldoDevedorCliente(clienteId, lancamentos);
  const diasAtraso = diasAtrasoSaldoDevedorCliente(clienteId, lancamentos);

  const bloqueado =
    limite > 0 &&
    saldo > 0 &&
    saldo >= limite &&
    diasAtraso > DIAS_BLOQUEIO_OS_SALDO_DEVEDOR;

  return { bloqueado, saldo, limite, diasAtraso };
}

export function mensagemBloqueioSaldoDevedorOs(info: BloqueioSaldoDevedorOs): string {
  const saldoFmt = info.saldo.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const limiteFmt = info.limite.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return `Este cliente atingiu o limite de saldo devedor (${limiteFmt}). Saldo atual: ${saldoFmt}, com títulos em atraso há ${info.diasAtraso} dias. Não é possível criar nova ordem de serviço após ${DIAS_BLOQUEIO_OS_SALDO_DEVEDOR} dias de atraso.`;
}
