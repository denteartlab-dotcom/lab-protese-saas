/** Extrai valor de linha em observações do cliente (ex.: "Limite Saldo Devedor: 1.000,00"). */
export function configValueFromObservacoes(
  observacoes: string | null | undefined,
  prefix: string
): string {
  if (!observacoes) return "";
  const line = observacoes
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.toLowerCase().startsWith(prefix.toLowerCase()));
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
