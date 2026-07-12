import type { MessageKey } from "@/lib/i18n";
import type {
  OpcaoEstoqueControle,
  OpcaoRelatorioEstoque,
} from "@/lib/relatorio-estoque";

type Tradutor = (key: MessageKey, params?: Record<string, string | number>) => string;

const CHAVES_RELATORIO: Record<OpcaoRelatorioEstoque, MessageKey> = {
  controle_produtos: "relatorio.estoque.opcao.controleProdutos",
  venda_produtos: "relatorio.estoque.opcao.vendaProdutos",
  movimentacao_agrupado: "relatorio.estoque.opcao.movimentacaoAgrupado",
  movimentacao: "relatorio.estoque.opcao.movimentacao",
};

const CHAVES_ESTOQUE: Record<OpcaoEstoqueControle, MessageKey> = {
  todos: "relatorio.estoque.opcao.todos",
  minimo: "relatorio.estoque.opcao.estoqueMinimo",
  maximo: "relatorio.estoque.opcao.estoqueMaximo",
  zero: "relatorio.estoque.opcao.estoqueZerado",
};

export function opcoesRelatorioEstoqueI18n(t: Tradutor) {
  return (Object.keys(CHAVES_RELATORIO) as OpcaoRelatorioEstoque[]).map((value) => ({
    value,
    label: t(CHAVES_RELATORIO[value]),
  }));
}

export function opcoesEstoqueControleI18n(t: Tradutor) {
  return (Object.keys(CHAVES_ESTOQUE) as OpcaoEstoqueControle[]).map((value) => ({
    value,
    label: t(CHAVES_ESTOQUE[value]),
  }));
}

export function labelOpcaoRelatorioEstoque(t: Tradutor, value: OpcaoRelatorioEstoque) {
  return t(CHAVES_RELATORIO[value]);
}

export function labelOpcaoEstoqueControle(t: Tradutor, value: OpcaoEstoqueControle) {
  return t(CHAVES_ESTOQUE[value]);
}
