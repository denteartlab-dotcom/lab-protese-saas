import { getProdutosEstoqueExtras } from "@/lib/estoque";
import { carregarEtapasCadastro } from "@/lib/etapas-os";

export type ItemCustoServico = {
  id: string;
  produtoId: string;
  nome: string;
  qtd: string;
  valorUnitario: string;
};

export function parseMoneyCustoServico(value: string) {
  return Number(String(value).replace(/\D/g, "")) / 100;
}

export function formatMoneyCustoServico(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function qtdNumericaCustoServico(rawQtd: string) {
  const raw = String(rawQtd ?? "1");
  const match = raw.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : 1;
}

export function resolverCustoUnitarioProduto(produtoId: string) {
  const extras = getProdutosEstoqueExtras();
  return Number(extras[produtoId]?.valorCusto) || 0;
}

/** Custo unitário sincronizado com o estoque; usa valor salvo se o produto não tiver custo. */
export function custoUnitarioItemCusto(item: ItemCustoServico) {
  const doEstoque = resolverCustoUnitarioProduto(item.produtoId);
  if (doEstoque > 0) return doEstoque;
  return parseMoneyCustoServico(item.valorUnitario || "0,00");
}

export function totalItemCustoServico(item: ItemCustoServico) {
  return qtdNumericaCustoServico(item.qtd) * custoUnitarioItemCusto(item);
}

export function totalCustosItensServico(itens?: ItemCustoServico[]) {
  return (itens || []).reduce((sum, item) => sum + totalItemCustoServico(item), 0);
}

export type ItemCustoMargemLinha = {
  item: string;
  quantidade: string;
  valor: number;
};

export function listarItensCustoMargemServico(
  itens?: ItemCustoServico[]
): ItemCustoMargemLinha[] {
  return (itens || [])
    .map((item) => ({
      item: item.nome || "—",
      quantidade:
        String(item.qtd ?? "1").trim() === "" ? "1" : String(item.qtd ?? "1"),
      valor: totalItemCustoServico(item),
    }))
    .filter((row) => row.valor > 0 || row.item !== "—");
}

type EtapaLegada = {
  id?: string;
  nome: string;
  qtd?: string;
  valorHora?: string;
};

type ServicoComCustosLegado = {
  tipo?: string;
  etapas?: EtapaLegada[];
  itensCusto?: ItemCustoServico[];
};

/** Mantém etapas só para produção e migra custos antigos para produtos do estoque quando possível. */
export function normalizarCustosServicoLegado<T extends ServicoComCustosLegado>(
  servico: T,
  produtosPorNome?: Map<string, { id: string; nome: string; valorCusto?: number }>
): T {
  if (servico.tipo && servico.tipo !== "servico") return servico;

  const etapasCadastro = new Set(
    carregarEtapasCadastro().map((etapa) => etapa.nome.trim().toLowerCase())
  );

  const etapas = [...(servico.etapas || [])];
  const etapasProducao = etapas.filter((etapa) =>
    etapasCadastro.has(etapa.nome.trim().toLowerCase())
  );
  const etapasCustosLegados = etapas.filter(
    (etapa) => !etapasCadastro.has(etapa.nome.trim().toLowerCase())
  );

  let itensCusto = [...(servico.itensCusto || [])];

  if (itensCusto.length === 0 && etapasCustosLegados.length > 0 && produtosPorNome) {
    for (const legado of etapasCustosLegados) {
      const produto = produtosPorNome.get(legado.nome.trim().toLowerCase());
      if (!produto) continue;
      const custoSalvo = parseMoneyCustoServico(legado.valorHora || "0,00");
      const custo =
        custoSalvo > 0
          ? custoSalvo
          : Number(produto.valorCusto) || resolverCustoUnitarioProduto(produto.id);
      itensCusto.push({
        id: legado.id || `${Date.now()}-${Math.random()}`,
        produtoId: produto.id,
        nome: produto.nome,
        qtd: legado.qtd ?? "1",
        valorUnitario: formatMoneyCustoServico(custo),
      });
    }
  }

  if (
    itensCusto.length === (servico.itensCusto?.length || 0) &&
    etapasProducao.length === etapas.length
  ) {
    return servico;
  }

  return {
    ...servico,
    etapas: etapasProducao,
    itensCusto,
  };
}
