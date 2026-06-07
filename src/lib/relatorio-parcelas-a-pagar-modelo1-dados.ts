import type { EntidadeDespesa } from "@/lib/lancamento-despesa";
import type { LinhaRelatorioDespesa } from "@/lib/relatorio-despesas";

export type CategoriaParcelasAPagar = {
  id: Exclude<EntidadeDespesa, "todos">;
  label: string;
};

export const CATEGORIAS_PARCELAS_A_PAGAR: CategoriaParcelasAPagar[] = [
  { id: "fornecedores", label: "Fornecedores" },
  { id: "colaboradores", label: "Colaboradores" },
  { id: "prestadores", label: "Prestadores" },
  { id: "entregadores", label: "Entregadores" },
  { id: "clientes", label: "Clientes" },
];

export type LinhaParcelasAPagarModelo1 = {
  nome: string;
  valor: number;
};

export type SecaoParcelasAPagarModelo1 = {
  categoria: CategoriaParcelasAPagar;
  linhas: LinhaParcelasAPagarModelo1[];
  subtotal: number;
};

export function montarSecoesParcelasAPagarModelo1(
  linhas: LinhaRelatorioDespesa[]
): SecaoParcelasAPagarModelo1[] {
  const pendentes = linhas.filter((l) => l.status === "pendente");

  return CATEGORIAS_PARCELAS_A_PAGAR.map((categoria) => {
    const mapa = new Map<string, number>();

    for (const linha of pendentes) {
      if (linha.entidade !== categoria.id) continue;
      const nome = linha.nome.trim() || "—";
      mapa.set(nome, (mapa.get(nome) ?? 0) + linha.valor);
    }

    const linhasSecao = Array.from(mapa.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const subtotal = linhasSecao.reduce((s, l) => s + l.valor, 0);

    return { categoria, linhas: linhasSecao, subtotal };
  });
}

export function totalParcelasAPagarModelo1(secoes: SecaoParcelasAPagarModelo1[]) {
  return secoes.reduce((s, secao) => s + secao.subtotal, 0);
}
