import {
  getProdutosEstoqueExtras,
  notificarProdutosEstoqueAtualizado,
  setProdutosEstoqueExtras,
} from "@/lib/estoque";
import type { ProdutoCatalogo } from "@/lib/produtos-catalogo";

export type ProdutoFormulario = {
  codigoBarras: string;
  nome: string;
  categoria: string;
  marca: string;
  etiqueta: string;
  unidadeMedida: string;
  estoque: string;
  estoqueMinimo: string;
  estoqueMaximo: string;
  valorCusto: string;
  valor: string;
  observacoes: string;
};

export function novoProdutoFormulario(): ProdutoFormulario {
  const unidade = "un (Unitário)";
  return {
    codigoBarras: "",
    nome: "",
    categoria: "",
    marca: "",
    etiqueta: "",
    unidadeMedida: unidade,
    estoque: formatQuantidadeProduto(0, unidade),
    estoqueMinimo: formatQuantidadeProduto(0, unidade),
    estoqueMaximo: formatQuantidadeProduto(0, unidade),
    valorCusto: "R$ 0,00",
    valor: "R$ 0,00",
    observacoes: "",
  };
}

export function parseMoedaProduto(value: string) {
  return Number(value.replace(/\D/g, "")) / 100;
}

export function formatMoedaProdutoInput(value: string) {
  return parseMoedaProduto(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function unidadeSuffix(unidade: string) {
  if (unidade.startsWith("kg")) return "kg";
  if (unidade.startsWith("l")) return "l";
  if (unidade.startsWith("m ")) return "m";
  if (unidade.startsWith("m (")) return "m";
  if (unidade.startsWith("cx")) return "cx";
  if (unidade.startsWith("g")) return "g";
  if (unidade.startsWith("ml")) return "ml";
  return "un";
}

function unidadeDecimal(unidade: string) {
  return ["kg", "l", "m", "g", "ml"].includes(unidadeSuffix(unidade));
}

export function parseQuantidadeProduto(value: string) {
  const cleaned = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(cleaned) || 0;
}

export function formatQuantidadeProduto(value: number, unidade: string) {
  const suffix = unidadeSuffix(unidade);
  const quantidade = unidadeDecimal(unidade)
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : String(Math.round(value));
  return `${quantidade}${suffix === "m" ? "m" : ` ${suffix}`}`;
}

export function formatQuantidadeProdutoInput(value: string, unidade: string) {
  const digits = value.replace(/\D/g, "");
  const numeric = unidadeDecimal(unidade) ? Number(digits || 0) / 1000 : Number(digits || 0);
  return formatQuantidadeProduto(numeric, unidade);
}

export function alterarUnidadeMedidaFormulario(
  form: ProdutoFormulario,
  unidadeMedida: string
): ProdutoFormulario {
  return {
    ...form,
    unidadeMedida,
    estoque: formatQuantidadeProduto(parseQuantidadeProduto(form.estoque), unidadeMedida),
    estoqueMinimo: formatQuantidadeProduto(
      parseQuantidadeProduto(form.estoqueMinimo),
      unidadeMedida
    ),
    estoqueMaximo: formatQuantidadeProduto(
      parseQuantidadeProduto(form.estoqueMaximo),
      unidadeMedida
    ),
  };
}

export async function cadastrarNovoProduto(
  form: ProdutoFormulario
): Promise<ProdutoCatalogo | null> {
  const nome = form.nome.trim();
  if (!nome) return null;

  const response = await fetch("/api/produtos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome,
      categoria: form.categoria,
      observacoes: form.observacoes,
      valor: parseMoedaProduto(form.valor),
    }),
  });

  if (!response.ok) return null;

  const produto = (await response.json()) as { id?: string; nome?: string; valor?: number };
  if (!produto?.id) return null;

  const extras = getProdutosEstoqueExtras();
  const valorCusto = parseMoedaProduto(form.valorCusto);
  const estoque = parseQuantidadeProduto(form.estoque);

  setProdutosEstoqueExtras({
    ...extras,
    [produto.id]: {
      marca: form.marca,
      etiqueta: form.etiqueta,
      codigoBarras: form.codigoBarras,
      unidadeMedida: form.unidadeMedida,
      estoque,
      estoqueMinimo: parseQuantidadeProduto(form.estoqueMinimo),
      estoqueMaximo: parseQuantidadeProduto(form.estoqueMaximo),
      valorCusto,
    },
  });

  notificarProdutosEstoqueAtualizado();

  return {
    id: produto.id,
    nome: produto.nome || nome,
    marca: form.marca || undefined,
    codigoBarras: form.codigoBarras || undefined,
    valorCusto,
    estoque,
  };
}
