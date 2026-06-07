import {
  montarBlocosDespesasModelo2,
  type DespesaModelo2Bloco,
} from "@/lib/relatorio-despesas-modelo2-dados";

type LancamentoDespesaGrupo = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
};

export type LinhaParcelaAPagarModelo2 = {
  num: string;
  parcela: string;
  vencimento: string;
  formaPagamento: string;
  valor: number;
};

export type GrupoParcelasAPagarModelo2 = {
  fornecedor: string;
  linhas: LinhaParcelaAPagarModelo2[];
  total: number;
};

function numLinha(numeroBase: string, indiceParcela: number) {
  const digits = numeroBase.replace(/\D/g, "");
  return `${digits}${indiceParcela}`;
}

function blocoParaGrupo(bloco: DespesaModelo2Bloco): GrupoParcelasAPagarModelo2 | null {
  const pendentes = bloco.parcelas.filter((p) => !p.quitada);
  if (pendentes.length === 0) return null;

  const linhas = pendentes.map((p) => {
    const indice = Number(p.parcela.split("/")[0]?.trim()) || 1;
    return {
      num: numLinha(bloco.numero, indice),
      parcela: p.parcela,
      vencimento: p.vencimento,
      formaPagamento: indice === 1 ? p.formaPagamento : "",
      valor: p.valor,
    };
  });

  const total = linhas.reduce((s, l) => s + l.valor, 0);

  return {
    fornecedor: bloco.fornecedor,
    linhas,
    total,
  };
}

export function montarGruposParcelasAPagarModelo2(
  lancamentos: LancamentoDespesaGrupo[],
  idsIncluidos: Set<string>
): GrupoParcelasAPagarModelo2[] {
  const blocos = montarBlocosDespesasModelo2(lancamentos, idsIncluidos);
  return blocos
    .map(blocoParaGrupo)
    .filter((g): g is GrupoParcelasAPagarModelo2 => g !== null);
}
