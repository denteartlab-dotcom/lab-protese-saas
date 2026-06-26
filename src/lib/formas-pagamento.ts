/** Opções padrão de forma de pagamento (Smart Prótese). */
export const FORMAS_PAGAMENTO = [
  "Boleto Bancário",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Cheque",
  "Depósito Bancário",
  "Dinheiro",
  "Pix",
  "Pix externo",
  "Transferência Bancária",
  "Outros",
] as const;

export type FormaPagamentoPadrao = (typeof FORMAS_PAGAMENTO)[number];

/** Despesa/receita lançada como boleto bancário (inclui rótulos "Boleto" e "Boleto Bancário"). */
export function formaEhBoleto(forma?: string | null): boolean {
  return (forma || "").trim().toLowerCase().includes("boleto");
}

export const FORMA_PAGAMENTO_PLACEHOLDER = "Forma Pagamento";
export const FORMA_PAGAMENTO_TODOS = "Todos";

/** Dropdown do filtro (Fluxo de Caixa, relatórios). */
export function opcoesFormaPagamentoFiltro(valoresExistentes: string[] = []) {
  const conhecidas = new Set<string>(FORMAS_PAGAMENTO);
  const reservados = new Set<string>([
    FORMA_PAGAMENTO_PLACEHOLDER,
    FORMA_PAGAMENTO_TODOS,
  ]);
  const extras = valoresExistentes
    .map((v) => v.trim())
    .filter((v) => v && !conhecidas.has(v) && !reservados.has(v));
  const unicosExtras = [...new Set(extras)].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
  return [
    FORMA_PAGAMENTO_PLACEHOLDER,
    FORMA_PAGAMENTO_TODOS,
    ...FORMAS_PAGAMENTO,
    ...unicosExtras,
  ];
}

/** Select de cadastro/lançamento (sem placeholder de filtro). */
export function opcoesFormaPagamentoLancamento() {
  return [...FORMAS_PAGAMENTO];
}
