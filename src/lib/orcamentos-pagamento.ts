export type FormaPagamentoOrcamento =
  | "a_vista"
  | "pix"
  | "cartao_credito"
  | "boleto";

export type CondicoesPagamentoOrcamento = {
  forma: FormaPagamentoOrcamento;
  parcelas: number;
};

const PAGAMENTO_PREFIX = "@@PAG@@";

const ROTULOS: Record<FormaPagamentoOrcamento, string> = {
  a_vista: "À vista",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  boleto: "Boleto",
};

type TradutorOrcamento = (
  key: `estoque.orcamentos.pagamento.${FormaPagamentoOrcamento}` | "estoque.orcamentos.pagamento.parcelas",
  params?: Record<string, string | number>
) => string;

export function rotuloCondicoesPagamentoI18n(
  c: CondicoesPagamentoOrcamento,
  t: TradutorOrcamento
): string {
  const base = t(`estoque.orcamentos.pagamento.${c.forma}`);
  if (c.forma === "cartao_credito" || c.forma === "boleto") {
    return t("estoque.orcamentos.pagamento.parcelas", { base, parcelas: c.parcelas });
  }
  return base;
}

export function rotuloCondicoesPagamento(c: CondicoesPagamentoOrcamento): string {
  const base = ROTULOS[c.forma];
  if (c.forma === "cartao_credito" || c.forma === "boleto") {
    return `${base} — ${c.parcelas}x`;
  }
  return base;
}

export function serializarCondicoesPagamento(
  c: CondicoesPagamentoOrcamento
): string {
  return `${PAGAMENTO_PREFIX}${JSON.stringify(c)}`;
}

export function parseCondicoesPagamento(
  raw: string | null | undefined
): CondicoesPagamentoOrcamento {
  if (!raw?.trim()) {
    return { forma: "a_vista", parcelas: 1 };
  }
  if (raw.startsWith(PAGAMENTO_PREFIX)) {
    try {
      const parsed = JSON.parse(
        raw.slice(PAGAMENTO_PREFIX.length)
      ) as CondicoesPagamentoOrcamento;
      if (parsed?.forma) {
        return {
          forma: parsed.forma,
          parcelas: normalizarParcelas(parsed.parcelas),
        };
      }
    } catch {
      /* texto legado */
    }
  }
  const lower = raw.toLowerCase();
  if (lower.includes("boleto")) {
    return { forma: "boleto", parcelas: extrairParcelasTexto(raw) };
  }
  if (lower.includes("cartão") || lower.includes("cartao")) {
    return { forma: "cartao_credito", parcelas: extrairParcelasTexto(raw) };
  }
  if (lower.includes("pix")) return { forma: "pix", parcelas: 1 };
  if (lower.includes("vista")) return { forma: "a_vista", parcelas: 1 };
  return { forma: "a_vista", parcelas: 1 };
}

function extrairParcelasTexto(texto: string): number {
  const m = texto.match(/(\d+)\s*x/i);
  return m ? normalizarParcelas(Number(m[1])) : 1;
}

export function normalizarParcelas(n: number | undefined): number {
  if (!n || Number.isNaN(n)) return 1;
  return Math.min(12, Math.max(1, Math.round(n)));
}

export function exigeParcelamento(forma: FormaPagamentoOrcamento): boolean {
  return forma === "cartao_credito" || forma === "boleto";
}

/** Texto da coluna Parcelamento na listagem de orçamentos. */
export function rotuloParcelamentoColuna(
  condicoesPagamento: string | null | undefined
): string {
  const c = parseCondicoesPagamento(condicoesPagamento);
  if (!exigeParcelamento(c.forma)) return "—";
  return `${c.parcelas}x`;
}

export const DIAS_ENTRE_PARCELAS_ORCAMENTO = 30;

/** Vencimentos a partir da data de aprovação: 1ª parcela +30 dias, 2ª +60 dias, etc. */
export function dataVencimentoParcelaOrcamento(
  dataAprovacao: Date,
  numeroParcela: number
): Date {
  const venc = new Date(dataAprovacao);
  venc.setHours(12, 0, 0, 0);
  venc.setDate(venc.getDate() + numeroParcela * DIAS_ENTRE_PARCELAS_ORCAMENTO);
  return venc;
}

export function dividirValorParcelas(total: number, quantidade: number): number[] {
  const qtd = Math.max(1, quantidade);
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / qtd);
  const resto = centavos - base * qtd;
  return Array.from({ length: qtd }, (_, i) => (base + (i < resto ? 1 : 0)) / 100);
}

export function itemOrcamentoLinhaNova(): {
  produtoId: string;
  produtoNome: string;
  marca: string;
  codigoBarras: string;
  imagemUrl?: string;
  quantidade: number;
  valorUnitario: number;
} {
  return {
    produtoId: `novo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    produtoNome: "",
    marca: "",
    codigoBarras: "",
    imagemUrl: undefined,
    quantidade: 1,
    valorUnitario: 0,
  };
}
