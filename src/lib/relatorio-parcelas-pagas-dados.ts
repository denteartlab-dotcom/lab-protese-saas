import {
  classificarEntidadeDespesa,
  desempacotarDespesa,
  type EntidadeDespesa,
} from "@/lib/lancamento-despesa";
import { formatDate } from "@/lib/utils";
import {
  CATEGORIAS_PARCELAS_A_PAGAR,
  type CategoriaParcelasAPagar,
} from "@/lib/relatorio-parcelas-a-pagar-modelo1-dados";

export { CATEGORIAS_PARCELAS_A_PAGAR };

type LancamentoParcelasPagas = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id?: string; nome: string } | null;
  trabalho?: { numeroOs: number } | null;
};

export type LinhaParcelasPagas = {
  nome: string;
  ref: string;
  parcela: string;
  venc: string;
  pagamento: string;
  formaPagamento: string;
  valor: number;
  juros: number;
  pago: number;
};

export type SecaoParcelasPagas = {
  categoria: CategoriaParcelasAPagar;
  linhas: LinhaParcelasPagas[];
  totalValor: number;
  totalJuros: number;
  totalPago: number;
};

function labelParcela(pack: ReturnType<typeof desempacotarDespesa>) {
  const noTexto = pack.texto.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (noTexto) return `${noTexto[1]} / ${noTexto[2]}`;
  const total = Number.parseInt(pack.parcela, 10);
  if (Number.isFinite(total) && total > 1) return `1 / ${total}`;
  return "1 / 1";
}

function linhaDeLancamento(lancamento: LancamentoParcelasPagas): LinhaParcelasPagas {
  const pack = desempacotarDespesa(lancamento.descricao);
  const ref =
    lancamento.trabalho?.numeroOs != null
      ? `OS ${lancamento.trabalho.numeroOs}`
      : pack.referencia !== "—"
        ? pack.referencia
        : "";
  const dataFmt = formatDate(lancamento.data);
  return {
    nome: lancamento.cliente?.nome || pack.nome || "—",
    ref,
    parcela: labelParcela(pack),
    venc: dataFmt,
    pagamento: dataFmt,
    formaPagamento: lancamento.formaPagamento?.trim() || "",
    valor: lancamento.valor,
    juros: 0,
    pago: lancamento.valor,
  };
}

function entidadeDoLancamento(lancamento: LancamentoParcelasPagas): EntidadeDespesa {
  const pack = desempacotarDespesa(lancamento.descricao);
  return (
    pack.meta.entidade ||
    classificarEntidadeDespesa(pack.nome, Boolean(lancamento.cliente?.id), {
      fornecedores: [],
      colaboradores: [],
      prestadores: [],
      entregadores: [],
    })
  );
}

export function montarSecoesParcelasPagas(
  lancamentos: LancamentoParcelasPagas[],
  idsIncluidos: Set<string>
): SecaoParcelasPagas[] {
  const pagas = lancamentos.filter(
    (l) => l.tipo === "despesa" && l.status === "pago" && idsIncluidos.has(l.id)
  );

  return CATEGORIAS_PARCELAS_A_PAGAR.map((categoria) => {
    const linhas = pagas
      .filter((l) => entidadeDoLancamento(l) === categoria.id)
      .map(linhaDeLancamento)
      .sort((a, b) => {
        const cmp = a.nome.localeCompare(b.nome, "pt-BR");
        if (cmp !== 0) return cmp;
        return a.pagamento.localeCompare(b.pagamento, "pt-BR");
      });

    const totalValor = linhas.reduce((s, l) => s + l.valor, 0);
    const totalJuros = linhas.reduce((s, l) => s + l.juros, 0);
    const totalPago = linhas.reduce((s, l) => s + l.pago, 0);

    return {
      categoria,
      linhas,
      totalValor,
      totalJuros,
      totalPago,
    };
  });
}

export function totalParcelasPagas(secoes: SecaoParcelasPagas[]) {
  return secoes.reduce((s, secao) => s + secao.totalPago, 0);
}
