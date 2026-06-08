import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";

export type ParcelaFaturaModelo2 = {
  parcela: string;
  vencimento: string;
  formaPagamento: string;
  valor: number;
  juros: number;
  recebido: number;
};

export type FaturaModelo2Bloco = {
  numero: number;
  cliente: string;
  dataEmissao: string;
  parcelas: ParcelaFaturaModelo2[];
  totalFatura: number;
  totalRecebido: number;
  saldo: number;
};

function formatarDataEmissao(data: Date) {
  const day = String(data.getDate()).padStart(2, "0");
  const month = String(data.getMonth() + 1).padStart(2, "0");
  const year = data.getFullYear();
  return `${day}/${month}/${year}`;
}

function numeroParcelaOrdenacao(parcela: string) {
  const match = parcela.match(/(\d+)\s*\/\s*(\d+)/);
  return match ? Number(match[1]) || 0 : 0;
}

function formatarParcelaLabel(parcela: string) {
  const match = parcela.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return parcela.trim() || "1/1";
  return `${match[1]}/${match[2]}`;
}

export function montarBlocosFaturasModelo2(
  linhas: LinhaRelatorioContasReceber[]
): FaturaModelo2Bloco[] {
  const mapa = new Map<number, LinhaRelatorioContasReceber[]>();

  for (const linha of linhas) {
    const lista = mapa.get(linha.numeroFatura) ?? [];
    lista.push(linha);
    mapa.set(linha.numeroFatura, lista);
  }

  return Array.from(mapa.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([numero, grupo]) => {
      const ordenadas = [...grupo].sort(
        (a, b) => numeroParcelaOrdenacao(a.parcela) - numeroParcelaOrdenacao(b.parcela)
      );
      const primeira = ordenadas[0];
      const dataEmissao = formatarDataEmissao(
        ordenadas.reduce(
          (min, linha) => (linha.dataLancamento < min ? linha.dataLancamento : min),
          ordenadas[0].dataLancamento
        )
      );

      const parcelas: ParcelaFaturaModelo2[] = ordenadas.map((linha) => ({
        parcela: formatarParcelaLabel(linha.parcela),
        vencimento: linha.vencimento,
        formaPagamento:
          linha.formaRecebimento && linha.formaRecebimento !== "—"
            ? linha.formaRecebimento
            : "",
        valor: linha.valor,
        juros: linha.juros ?? 0,
        recebido: linha.recebido,
      }));

      const totalFatura = parcelas.reduce((s, p) => s + p.valor, 0);
      const totalRecebido = parcelas.reduce((s, p) => s + p.recebido, 0);
      const saldo = ordenadas.reduce((s, linha) => s + linha.saldo, 0);

      return {
        numero,
        cliente: primeira.cliente,
        dataEmissao,
        parcelas,
        totalFatura,
        totalRecebido,
        saldo,
      };
    });
}
