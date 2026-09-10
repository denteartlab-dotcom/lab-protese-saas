export type FormaPagamentoOrcamento =
  | "a_vista"
  | "pix"
  | "cartao_credito"
  | "boleto";

export type CondicoesPagamentoOrcamento = {
  id?: string;
  forma: FormaPagamentoOrcamento;
  parcelas: number;
  /** Valor ofertado nesta condição (opcional). */
  valor?: number;
  /** Tipo do desconto à vista / Pix. */
  descontoTipo?: "percentual" | "valor";
  /** Desconto (% ou R$) aplicado nesta condição. */
  desconto?: number;
};

const PAGAMENTO_PREFIX = "@@PAG@@";

const ROTULOS: Record<FormaPagamentoOrcamento, string> = {
  a_vista: "À vista",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  boleto: "Boleto",
};

type TradutorOrcamento = (
  key:
    | `estoque.orcamentos.pagamento.${FormaPagamentoOrcamento}`
    | "estoque.orcamentos.pagamento.parcelas",
  params?: Record<string, string | number>
) => string;

function moneyBr(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizarCondicao(
  raw: Partial<CondicoesPagamentoOrcamento> | null | undefined
): CondicoesPagamentoOrcamento | null {
  if (!raw?.forma) return null;
  const forma = raw.forma;
  const parcelas = exigeParcelamento(forma)
    ? normalizarParcelas(raw.parcelas)
    : 1;
  const valor =
    typeof raw.valor === "number" && Number.isFinite(raw.valor) && raw.valor >= 0
      ? raw.valor
      : undefined;
  const descontoTipo =
    raw.descontoTipo === "valor" || raw.descontoTipo === "percentual"
      ? raw.descontoTipo
      : undefined;
  const desconto =
    typeof raw.desconto === "number" &&
    Number.isFinite(raw.desconto) &&
    raw.desconto > 0
      ? raw.desconto
      : undefined;
  return {
    id: raw.id || undefined,
    forma,
    parcelas,
    valor,
    descontoTipo: desconto != null ? descontoTipo || "percentual" : undefined,
    desconto,
  };
}

export function valorLiquidoCondicao(
  c: CondicoesPagamentoOrcamento,
  totalBase = 0
): number {
  let base =
    typeof c.valor === "number" && Number.isFinite(c.valor) ? c.valor : totalBase;
  if (!(base > 0)) base = totalBase;
  const desc = c.desconto || 0;
  if (!(desc > 0)) return Math.max(0, base);
  if (c.descontoTipo === "valor") return Math.max(0, base - desc);
  return Math.max(0, base * (1 - Math.min(desc, 100) / 100));
}

function extrasRotulo(c: CondicoesPagamentoOrcamento): string[] {
  const extras: string[] = [];
  if (typeof c.valor === "number" && c.valor > 0) {
    extras.push(moneyBr(c.valor));
  }
  if (c.desconto && c.desconto > 0) {
    extras.push(
      c.descontoTipo === "valor"
        ? `desc. ${moneyBr(c.desconto)}`
        : `desc. ${c.desconto}%`
    );
  }
  return extras;
}

export function rotuloCondicoesPagamentoI18n(
  c: CondicoesPagamentoOrcamento,
  t: TradutorOrcamento
): string {
  const base = t(`estoque.orcamentos.pagamento.${c.forma}`);
  let texto =
    c.forma === "cartao_credito" || c.forma === "boleto"
      ? t("estoque.orcamentos.pagamento.parcelas", {
          base,
          parcelas: c.parcelas,
        })
      : base;
  const extras = extrasRotulo(c);
  if (extras.length) texto = `${texto} — ${extras.join(" · ")}`;
  return texto;
}

export function rotuloCondicoesPagamento(c: CondicoesPagamentoOrcamento): string {
  const base = ROTULOS[c.forma];
  let texto =
    c.forma === "cartao_credito" || c.forma === "boleto"
      ? `${base} — ${c.parcelas}x`
      : base;
  const extras = extrasRotulo(c);
  if (extras.length) texto = `${texto} — ${extras.join(" · ")}`;
  return texto;
}

export function rotuloListaCondicoesPagamento(
  lista: CondicoesPagamentoOrcamento[]
): string {
  if (lista.length === 0) return "—";
  return lista.map((c) => rotuloCondicoesPagamento(c)).join(" | ");
}

export function serializarCondicoesPagamento(
  c: CondicoesPagamentoOrcamento
): string {
  return serializarListaCondicoesPagamento([c]);
}

export function serializarListaCondicoesPagamento(
  lista: CondicoesPagamentoOrcamento[]
): string {
  const limpa = lista
    .map((c) => normalizarCondicao(c))
    .filter((c): c is CondicoesPagamentoOrcamento => Boolean(c));
  if (limpa.length === 0) return "";
  if (limpa.length === 1) {
    return `${PAGAMENTO_PREFIX}${JSON.stringify(limpa[0])}`;
  }
  return `${PAGAMENTO_PREFIX}${JSON.stringify(limpa)}`;
}

function extrairParcelasTexto(texto: string): number {
  const m = texto.match(/(\d+)\s*x/i);
  return m ? normalizarParcelas(Number(m[1])) : 1;
}

function parseTextoLegado(raw: string): CondicoesPagamentoOrcamento {
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

export function parseListaCondicoesPagamento(
  raw: string | null | undefined
): CondicoesPagamentoOrcamento[] {
  if (!raw?.trim()) return [];
  if (raw.startsWith(PAGAMENTO_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(PAGAMENTO_PREFIX.length)) as
        | CondicoesPagamentoOrcamento
        | CondicoesPagamentoOrcamento[];
      if (Array.isArray(parsed)) {
        return parsed
          .map((c) => normalizarCondicao(c))
          .filter((c): c is CondicoesPagamentoOrcamento => Boolean(c));
      }
      const uma = normalizarCondicao(parsed);
      return uma ? [uma] : [];
    } catch {
      /* texto legado */
    }
  }
  return [parseTextoLegado(raw)];
}

/** Compat: preferência financeira = parcelado se existir, senão a primeira. */
export function parseCondicoesPagamento(
  raw: string | null | undefined
): CondicoesPagamentoOrcamento {
  const lista = parseListaCondicoesPagamento(raw);
  if (lista.length === 0) return { forma: "a_vista", parcelas: 1 };
  return (
    lista.find((c) => exigeParcelamento(c.forma)) ||
    lista[0] || { forma: "a_vista", parcelas: 1 }
  );
}

export function normalizarParcelas(n: number | undefined): number {
  if (!n || Number.isNaN(n)) return 1;
  return Math.min(12, Math.max(1, Math.round(n)));
}

export function exigeParcelamento(forma: FormaPagamentoOrcamento): boolean {
  return forma === "cartao_credito" || forma === "boleto";
}

export function exigeValorDescontoVista(forma: FormaPagamentoOrcamento): boolean {
  return forma === "a_vista" || forma === "pix";
}

/** Texto da coluna Parcelamento na listagem de orçamentos. */
export function rotuloParcelamentoColuna(
  condicoesPagamento: string | null | undefined
): string {
  const lista = parseListaCondicoesPagamento(condicoesPagamento);
  const parceladas = lista.filter((c) => exigeParcelamento(c.forma));
  if (parceladas.length === 0) return "—";
  if (parceladas.length === 1) return `${parceladas[0]!.parcelas}x`;
  return parceladas.map((c) => `${c.parcelas}x`).join(", ");
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
