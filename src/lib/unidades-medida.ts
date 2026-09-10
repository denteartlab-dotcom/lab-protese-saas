/** Unidades de medida compartilhadas (produtos / orçamentos). */

export const UNIDADE_MEDIDA_PADRAO = "un (Unitário)";

export const UNIDADES_MEDIDA = [
  { value: "un (Unitário)", key: "estoque.produtos.unidade.un" as const },
  { value: "cx (Caixa)", key: "estoque.produtos.unidade.cx" as const },
  { value: "kg (Quilograma)", key: "estoque.produtos.unidade.kg" as const },
  { value: "g (Grama)", key: "estoque.produtos.unidade.g" as const },
  { value: "l (Litro)", key: "estoque.produtos.unidade.l" as const },
  { value: "m (Metro)", key: "estoque.produtos.unidade.m" as const },
  { value: "ml (Mililitro)", key: "estoque.produtos.unidade.ml" as const },
] as const;

export type UnidadeMedidaValue = (typeof UNIDADES_MEDIDA)[number]["value"];

export function unidadeSuffix(unidade: string) {
  const raw = (unidade || "").trim().toLowerCase();
  if (!raw) return "un";
  const antesParenteses = raw.split("(")[0]?.trim() || raw;
  return antesParenteses.split(/\s+/)[0] || "un";
}

export function unidadeEhDecimal(unidade: string) {
  return ["kg", "l", "m", "g", "ml"].includes(unidadeSuffix(unidade));
}

export function normalizarUnidadeMedida(valor?: string | null) {
  const limpo = (valor || "").trim();
  if (!limpo) return UNIDADE_MEDIDA_PADRAO;
  const exata = UNIDADES_MEDIDA.find((u) => u.value === limpo);
  if (exata) return exata.value;
  const porSuffix = UNIDADES_MEDIDA.find(
    (u) => unidadeSuffix(u.value) === unidadeSuffix(limpo)
  );
  if (porSuffix) return porSuffix.value;
  return limpo;
}

/** Sufixo curto para exibição (g, kg, ml, L, un…). */
export function rotuloUnidadeCurto(unidade?: string | null) {
  const s = unidadeSuffix(unidade || UNIDADE_MEDIDA_PADRAO);
  if (s === "l") return "L";
  return s;
}
