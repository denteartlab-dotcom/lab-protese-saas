import { dateToBrShort, parseBrDate } from "@/lib/datas-br";
import {
  listarTodosMovimentosEstoque,
  type MovimentoEstoque,
} from "@/lib/estoque";

export type OpcaoRelatorioEstoque =
  | "movimentacao"
  | "movimentacao_agrupado"
  | "controle_produtos"
  | "venda_produtos";

export const OPCOES_RELATORIO_ESTOQUE: { value: OpcaoRelatorioEstoque; label: string }[] = [
  { value: "controle_produtos", label: "Controle de Produtos" },
  { value: "venda_produtos", label: "Relatório Venda de Produtos" },
  { value: "movimentacao_agrupado", label: "Movimentação de Estoque (Agrupado)" },
  { value: "movimentacao", label: "Movimentação do Estoque" },
];

export type OpcaoEstoqueControle = "todos" | "minimo" | "maximo" | "zero";

export const OPCOES_ESTOQUE_CONTROLE: { value: OpcaoEstoqueControle; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "minimo", label: "Estoque Mínimo" },
  { value: "maximo", label: "Estoque Máximo" },
  { value: "zero", label: "Estoque Zerado" },
];

export type ProdutoRelatorioEstoque = {
  id: string;
  nome: string;
  codigoBarras?: string;
  etiqueta?: string;
  marca?: string;
  unidadeMedida?: string;
  estoque?: number;
  estoqueMinimo?: number;
  estoqueMaximo?: number;
  valorCusto?: number;
  valorVenda?: number;
};

export type FiltrosControleProdutos = {
  opcaoEstoque: OpcaoEstoqueControle;
  etiqueta: string;
};

export type LinhaControleProduto = {
  id: string;
  codigo: string;
  produto: string;
  etiqueta: string;
  marca: string;
  estoqueAtual: number;
  estoqueAtualLabel: string;
  situacao: "Alto" | "Baixo" | null;
  unidade: string;
  minimo: number;
  minimoLabel: string;
  maximo: number;
  maximoLabel: string;
  custo: number;
  venda: number;
  total: number;
};

export type TotaisControleProduto = {
  totalGeral: number;
};

export type TrabalhoDataEntregaRelatorio = {
  dataEntrega?: string | Date | null;
};

export type FiltrosVendaProdutos = {
  dataInicio: string;
  dataFim: string;
};

export type LinhaVendaProduto = {
  id: string;
  dataEntregue: string;
  dataEntregueOrdenacao: number;
  quantidade: number;
  quantidadeLabel: string;
  produto: string;
  marca: string;
  valorCusto: number;
  venda: number;
  lucro: number;
};

export type TotaisVendaProduto = {
  valorCusto: number;
  venda: number;
  lucro: number;
};

export type LinhaPosicaoEstoque = {
  id: string;
  produto: string;
  etiqueta: string;
  marca: string;
  entradas: number;
  saidas: number;
  estoqueAtual: number;
  estoqueAtualLabel: string;
  situacao: "Alto" | "Baixo" | null;
  valorUnitario: number;
  valor: number;
};

export type TotaisPosicaoEstoque = {
  entradas: number;
  saidas: number;
  valor: number;
};

export type FiltrosRelatorioEstoque = {
  colaborador: string;
  etiqueta: string;
  tipoMovimento: string;
  setor: string;
  dataInicio: string;
  dataFim: string;
};

export type LinhaRelatorioEstoque = {
  id: string;
  dataIso: string;
  dataLabel: string;
  tipo: string;
  tipoKey: MovimentoEstoque["tipo"];
  produto: string;
  produtoId: string;
  etiqueta: string;
  quantidade: number;
  quantidadeLabel: string;
  setor: string;
  colaborador: string;
};

export function formatarDataMovimentoEstoque(dataIso: string) {
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function labelTipoMovimentoEstoque(tipo: MovimentoEstoque["tipo"]) {
  return tipo === "entrada" ? "Entrada" : "Saída";
}

export function colaboradorMovimentoEstoque(movimento: MovimentoEstoque) {
  if (movimento.origem === "colaborador") return movimento.responsavel?.trim() || "";
  if (movimento.origem === "fornecedor" || movimento.origem === "prestador") {
    return movimento.responsavel?.trim() || "";
  }
  if (movimento.origem === "os") return "";
  return movimento.responsavel?.trim() || "";
}

function formatarQuantidadeRelatorio(quantidade: number) {
  const q = Number(quantidade);
  if (!Number.isFinite(q)) return "0";
  if (Number.isInteger(q)) return String(q);
  return q.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function moneyRelatorioEstoque(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sufixoUnidade(unidadeMedida?: string) {
  const u = (unidadeMedida || "").toLowerCase();
  if (u.startsWith("kg")) return "kg";
  if (u.startsWith("l")) return "l";
  if (u.startsWith("m")) return "m";
  if (u.startsWith("cx")) return "cx";
  if (u.startsWith("g")) return "g";
  if (u.startsWith("ml")) return "ml";
  return "un";
}

function formatarEstoqueAtual(quantidade: number, unidadeMedida?: string) {
  const q = Number(quantidade);
  const suf = sufixoUnidade(unidadeMedida);
  if (!Number.isFinite(q)) return `0 ${suf}`;
  const texto =
    suf === "un"
      ? String(Math.round(q))
      : q.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return `${texto} ${suf}`;
}

/**
 * Indicador do estoque atual vs mínimo/máximo cadastrados no produto (igual tela de Estoque).
 * Alto: estoque >= máximo (com máximo > 0).
 * Baixo: estoque <= mínimo (com mínimo > 0), inclusive zerado.
 */
export function situacaoEstoqueProduto(produto: ProdutoRelatorioEstoque): "Alto" | "Baixo" | null {
  const atual = Number(produto.estoque) || 0;
  const min = Number(produto.estoqueMinimo) || 0;
  const max = Number(produto.estoqueMaximo) || 0;

  if (max > 0 && atual > 0 && atual >= max) return "Alto";
  if (min > 0 && atual <= min) return "Baixo";
  return null;
}

function produtoPassaFiltroEtiqueta(
  produto: ProdutoRelatorioEstoque,
  etiquetaFiltro: string
) {
  if (!etiquetaFiltro || etiquetaFiltro === "Todas") return true;
  return (produto.etiqueta || "").trim() === etiquetaFiltro;
}

function produtoPassaOpcaoEstoque(
  produto: ProdutoRelatorioEstoque,
  opcao: OpcaoEstoqueControle
) {
  const estoque = Number(produto.estoque) || 0;
  const min = Number(produto.estoqueMinimo) || 0;
  const max = Number(produto.estoqueMaximo) || 0;
  if (opcao === "minimo") return min > 0 && estoque > 0 && estoque <= min;
  if (opcao === "maximo") return max > 0 && estoque > 0 && estoque >= max;
  if (opcao === "zero") return estoque === 0;
  return true;
}

function formatarQtdCampo(quantidade: number, unidadeMedida?: string) {
  const q = Number(quantidade) || 0;
  const suf = sufixoUnidade(unidadeMedida);
  if (suf === "un") return String(Math.round(q));
  return q.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function movimentoNoPeriodo(dataIso: string, inicio: Date | null, fim: Date | null) {
  if (!inicio || !fim) return true;
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return false;
  return d >= inicio && d <= fim;
}

export function filtrarMovimentosRelatorioEstoque(
  movimentos: MovimentoEstoque[],
  produtosPorId: Map<string, ProdutoRelatorioEstoque>,
  filtros: FiltrosRelatorioEstoque
) {
  const inicio = filtros.dataInicio ? parseBrDate(filtros.dataInicio) : null;
  const fim = filtros.dataFim ? parseBrDate(filtros.dataFim) : null;
  if (inicio) inicio.setHours(0, 0, 0, 0);
  if (fim) fim.setHours(23, 59, 59, 999);

  return movimentos.filter((m) => {
    if (!movimentoNoPeriodo(m.data, inicio, fim)) return false;

    const produto = produtosPorId.get(m.produtoId);
    const etiquetaProduto = (produto?.etiqueta || "").trim();

    if (filtros.etiqueta && filtros.etiqueta !== "Todas" && etiquetaProduto !== filtros.etiqueta) {
      return false;
    }

    if (filtros.tipoMovimento && filtros.tipoMovimento !== "Todos") {
      const esperado = filtros.tipoMovimento === "Entrada" ? "entrada" : "saida";
      if (m.tipo !== esperado) return false;
    }

    if (filtros.setor && filtros.setor !== "Todos") {
      if ((m.setor || "").trim() !== filtros.setor) return false;
    }

    const colFiltro = filtros.colaborador?.trim();
    if (colFiltro && colFiltro !== "Todos") {
      const col = colaboradorMovimentoEstoque(m);
      if (col !== colFiltro) return false;
    }

    return true;
  });
}

export function montarLinhasRelatorioEstoque(
  movimentos: MovimentoEstoque[],
  produtosPorId: Map<string, ProdutoRelatorioEstoque>
): LinhaRelatorioEstoque[] {
  return movimentos.map((m) => {
    const produto = produtosPorId.get(m.produtoId);
    const nomeProduto = produto?.nome?.trim() || "—";
    const etiqueta = (produto?.etiqueta || "").trim();

    return {
      id: m.id || `${m.produtoId}-${m.data}-${m.tipo}-${m.quantidade}`,
      dataIso: m.data,
      dataLabel: formatarDataMovimentoEstoque(m.data),
      tipo: labelTipoMovimentoEstoque(m.tipo),
      tipoKey: m.tipo,
      produto: nomeProduto,
      produtoId: m.produtoId,
      etiqueta,
      quantidade: Number(m.quantidade) || 0,
      quantidadeLabel: formatarQuantidadeRelatorio(m.quantidade),
      setor: (m.setor || "").trim(),
      colaborador: colaboradorMovimentoEstoque(m),
    };
  });
}

export function gerarRelatorioMovimentacaoEstoque(
  movimentos: MovimentoEstoque[],
  produtosPorId: Map<string, ProdutoRelatorioEstoque>,
  filtros: FiltrosRelatorioEstoque
) {
  const filtrados = filtrarMovimentosRelatorioEstoque(movimentos, produtosPorId, filtros);
  return montarLinhasRelatorioEstoque(filtrados, produtosPorId);
}

export function gerarRelatorioPosicaoEstoque(
  movimentos: MovimentoEstoque[],
  produtosPorId: Map<string, ProdutoRelatorioEstoque>,
  filtros: FiltrosRelatorioEstoque
): { linhas: LinhaPosicaoEstoque[]; totais: TotaisPosicaoEstoque } {
  const filtrados = filtrarMovimentosRelatorioEstoque(movimentos, produtosPorId, filtros);
  const agregado = new Map<string, { entradas: number; saidas: number }>();

  for (const m of filtrados) {
    const atual = agregado.get(m.produtoId) || { entradas: 0, saidas: 0 };
    const qtd = Number(m.quantidade) || 0;
    if (m.tipo === "entrada") atual.entradas += qtd;
    else atual.saidas += qtd;
    agregado.set(m.produtoId, atual);
  }

  const linhas: LinhaPosicaoEstoque[] = [];

  for (const produto of produtosPorId.values()) {
    if (!produtoPassaFiltroEtiqueta(produto, filtros.etiqueta)) continue;

    const mov = agregado.get(produto.id) || { entradas: 0, saidas: 0 };
    const estoqueAtual = Number(produto.estoque) || 0;
    if (mov.entradas <= 0 && mov.saidas <= 0 && estoqueAtual <= 0) continue;

    const valorUnitario = Number(produto.valorCusto) || 0;
    const valor = Math.round(estoqueAtual * valorUnitario * 100) / 100;

    linhas.push({
      id: produto.id,
      produto: produto.nome,
      etiqueta: (produto.etiqueta || "").trim(),
      marca: (produto.marca || "").trim(),
      entradas: mov.entradas,
      saidas: mov.saidas,
      estoqueAtual,
      estoqueAtualLabel: formatarEstoqueAtual(estoqueAtual, produto.unidadeMedida),
      situacao: situacaoEstoqueProduto(produto),
      valorUnitario,
      valor,
    });
  }

  linhas.sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR"));

  const totais = linhas.reduce(
    (acc, l) => ({
      entradas: acc.entradas + l.entradas,
      saidas: acc.saidas + l.saidas,
      valor: acc.valor + l.valor,
    }),
    { entradas: 0, saidas: 0, valor: 0 }
  );

  return { linhas, totais };
}

export function exportarRelatorioPosicaoEstoqueCsv(
  linhas: LinhaPosicaoEstoque[],
  totais: TotaisPosicaoEstoque
) {
  const header = "PRODUTO;ETIQUETA;MARCA;ENTRADAS;SAÍDAS;ESTOQUE ATUAL;VALOR UNITÁRIO;VALOR";
  const body = linhas.map(
    (l) =>
      `${l.produto};${l.etiqueta};${l.marca};${formatarQuantidadeRelatorio(l.entradas)};${formatarQuantidadeRelatorio(l.saidas)};${l.estoqueAtualLabel};${moneyRelatorioEstoque(l.valorUnitario)};${moneyRelatorioEstoque(l.valor)}`
  );
  body.push(
    `Totais;;${formatarQuantidadeRelatorio(totais.entradas)};${formatarQuantidadeRelatorio(totais.saidas)};;${moneyRelatorioEstoque(totais.valor)}`
  );
  const blob = new Blob(["\uFEFF" + [header, ...body].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `posicao-estoque-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarRelatorioEstoqueCsv(linhas: LinhaRelatorioEstoque[]) {
  const header = "DATA;TIPO;PRODUTO;ETIQUETA;QUANTIDADE;SETOR;COLABORADOR";
  const body = linhas.map(
    (l) =>
      `${l.dataLabel};${l.tipo};${l.produto};${l.etiqueta};${l.quantidadeLabel};${l.setor};${l.colaborador}`
  );
  const blob = new Blob(["\uFEFF" + [header, ...body].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-estoque-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function coletarEtiquetasProdutos(produtos: ProdutoRelatorioEstoque[]) {
  const set = new Set<string>();
  for (const p of produtos) {
    const e = (p.etiqueta || "").trim();
    if (e) set.add(e);
  }
  return ["Todas", ...[...set].sort((a, b) => a.localeCompare(b, "pt-BR"))];
}

export function coletarColaboradoresMovimentos(movimentos: MovimentoEstoque[]) {
  const set = new Set<string>();
  for (const m of movimentos) {
    const c = colaboradorMovimentoEstoque(m);
    if (c) set.add(c);
  }
  return ["", ...[...set].sort((a, b) => a.localeCompare(b, "pt-BR"))];
}

export function coletarSetoresMovimentos(
  movimentos: MovimentoEstoque[],
  setoresCadastro: string[]
) {
  const set = new Set<string>(setoresCadastro.filter(Boolean));
  for (const m of movimentos) {
    const s = (m.setor || "").trim();
    if (s) set.add(s);
  }
  return ["Todos", ...[...set].sort((a, b) => a.localeCompare(b, "pt-BR"))];
}

/** Controle de produtos — snapshot do cadastro (sem período). */
export function gerarRelatorioControleProdutos(
  produtosPorId: Map<string, ProdutoRelatorioEstoque>,
  filtros: FiltrosControleProdutos
): { linhas: LinhaControleProduto[]; totais: TotaisControleProduto } {
  const linhas: LinhaControleProduto[] = [];

  for (const produto of produtosPorId.values()) {
    if (!produtoPassaFiltroEtiqueta(produto, filtros.etiqueta)) continue;
    if (!produtoPassaOpcaoEstoque(produto, filtros.opcaoEstoque)) continue;

    const estoqueAtual = Number(produto.estoque) || 0;
    const custo = Number(produto.valorCusto) || 0;
    const venda = Number(produto.valorVenda) || 0;
    const total = Math.round(estoqueAtual * custo * 100) / 100;
    const unidade = sufixoUnidade(produto.unidadeMedida);

    linhas.push({
      id: produto.id,
      codigo: (produto.codigoBarras || "").trim(),
      produto: produto.nome,
      etiqueta: (produto.etiqueta || "").trim(),
      marca: (produto.marca || "").trim(),
      estoqueAtual,
      estoqueAtualLabel: formatarEstoqueAtual(estoqueAtual, produto.unidadeMedida),
      situacao: situacaoEstoqueProduto(produto),
      unidade,
      minimo: Number(produto.estoqueMinimo) || 0,
      minimoLabel: formatarQtdCampo(produto.estoqueMinimo || 0, produto.unidadeMedida),
      maximo: Number(produto.estoqueMaximo) || 0,
      maximoLabel: formatarQtdCampo(produto.estoqueMaximo || 0, produto.unidadeMedida),
      custo,
      venda,
      total,
    });
  }

  linhas.sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR"));

  const totalGeral = linhas.reduce((s, l) => s + l.total, 0);
  return { linhas, totais: { totalGeral } };
}

export function formatarDataEntregueRelatorio(data: Date | string | null | undefined) {
  if (!data) return "-";
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return "-";
  return dateToBrShort(d);
}

function resolverDataEntregueMovimento(
  movimento: MovimentoEstoque,
  trabalhosPorId: Map<string, TrabalhoDataEntregaRelatorio>
): Date | null {
  if (movimento.origem === "os" && movimento.referencia) {
    const trabalho = trabalhosPorId.get(movimento.referencia);
    if (trabalho?.dataEntrega) {
      const entrega = new Date(trabalho.dataEntrega);
      if (!Number.isNaN(entrega.getTime())) return entrega;
    }
  }
  const mov = new Date(movimento.data);
  if (Number.isNaN(mov.getTime())) return null;
  return mov;
}

function dataEntregueNoPeriodo(dataEntregue: Date | null, inicio: Date | null, fim: Date | null) {
  if (!dataEntregue) return false;
  if (!inicio || !fim) return true;
  const d = new Date(dataEntregue);
  d.setHours(12, 0, 0, 0);
  return d >= inicio && d <= fim;
}

/** Vendas = saídas de estoque filtradas pela data entregue (OS usa dataEntrega). */
export function gerarRelatorioVendaProdutos(
  movimentos: MovimentoEstoque[],
  produtosPorId: Map<string, ProdutoRelatorioEstoque>,
  trabalhosPorId: Map<string, TrabalhoDataEntregaRelatorio>,
  filtros: FiltrosVendaProdutos
): { linhas: LinhaVendaProduto[]; totais: TotaisVendaProduto } {
  const inicio = filtros.dataInicio ? parseBrDate(filtros.dataInicio) : null;
  const fim = filtros.dataFim ? parseBrDate(filtros.dataFim) : null;
  if (inicio) inicio.setHours(0, 0, 0, 0);
  if (fim) fim.setHours(23, 59, 59, 999);

  const linhas: LinhaVendaProduto[] = [];

  for (const movimento of movimentos) {
    if (movimento.tipo !== "saida") continue;

    const dataEntregue = resolverDataEntregueMovimento(movimento, trabalhosPorId);
    if (!dataEntregueNoPeriodo(dataEntregue, inicio, fim)) continue;

    const produto = produtosPorId.get(movimento.produtoId);
    const qtd = Number(movimento.quantidade) || 0;
    const custoUnit = Number(produto?.valorCusto) || 0;
    const vendaUnit = Number(produto?.valorVenda) || 0;
    const valorCusto = Math.round(custoUnit * qtd * 100) / 100;
    const venda = Math.round(vendaUnit * qtd * 100) / 100;
    const lucro = Math.round((venda - valorCusto) * 100) / 100;

    linhas.push({
      id: movimento.id || `${movimento.produtoId}-${movimento.data}-${qtd}`,
      dataEntregue: formatarDataEntregueRelatorio(dataEntregue),
      dataEntregueOrdenacao: dataEntregue.getTime(),
      quantidade: qtd,
      quantidadeLabel: formatarQuantidadeRelatorio(qtd),
      produto: produto?.nome?.trim() || "—",
      marca: (produto?.marca || "").trim(),
      valorCusto,
      venda,
      lucro,
    });
  }

  linhas.sort((a, b) => b.dataEntregueOrdenacao - a.dataEntregueOrdenacao);

  const totais = linhas.reduce(
    (acc, l) => ({
      valorCusto: acc.valorCusto + l.valorCusto,
      venda: acc.venda + l.venda,
      lucro: acc.lucro + l.lucro,
    }),
    { valorCusto: 0, venda: 0, lucro: 0 }
  );

  return {
    linhas,
    totais: {
      valorCusto: Math.round(totais.valorCusto * 100) / 100,
      venda: Math.round(totais.venda * 100) / 100,
      lucro: Math.round(totais.lucro * 100) / 100,
    },
  };
}

export function exportarRelatorioVendaProdutosCsv(
  linhas: LinhaVendaProduto[],
  totais: TotaisVendaProduto
) {
  const header =
    "DATA ENTREGUE;QUANTIDADE;PRODUTO;MARCA;VALOR CUSTO (ULTIMA COMPRA);VENDA;LUCRO";
  const body = linhas.map(
    (l) =>
      `${l.dataEntregue};${l.quantidadeLabel};${l.produto};${l.marca};${moneyRelatorioEstoque(l.valorCusto)};${moneyRelatorioEstoque(l.venda)};${moneyRelatorioEstoque(l.lucro)}`
  );
  body.push(
    `;;;Total;${moneyRelatorioEstoque(totais.valorCusto)};${moneyRelatorioEstoque(totais.venda)};${moneyRelatorioEstoque(totais.lucro)}`
  );
  const blob = new Blob(["\uFEFF" + [header, ...body].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `venda-produtos-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarRelatorioControleProdutosCsv(
  linhas: LinhaControleProduto[],
  totais: TotaisControleProduto
) {
  const header =
    "CODIGO;PRODUTO;ETIQUETA;MARCA;ESTOQUE ATUAL;UNIDADE;MINIMO;MAXIMO;CUSTO;VENDA;TOTAL";
  const body = linhas.map(
    (l) =>
      `${l.codigo};${l.produto};${l.etiqueta};${l.marca};${l.estoqueAtualLabel};${l.unidade};${l.minimoLabel};${l.maximoLabel};${moneyRelatorioEstoque(l.custo)};${moneyRelatorioEstoque(l.venda)};${moneyRelatorioEstoque(l.total)}`
  );
  body.push(`;;;;;;;0,00;0,00;${moneyRelatorioEstoque(totais.totalGeral)}`);
  const blob = new Blob(["\uFEFF" + [header, ...body].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `controle-produtos-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
