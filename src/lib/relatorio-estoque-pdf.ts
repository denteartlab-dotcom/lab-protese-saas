import { moneyRelatorioEstoque } from "@/lib/relatorio-estoque";
import type { LinhaControleProduto } from "@/lib/relatorio-estoque";
import type { LinhaPosicaoEstoque } from "@/lib/relatorio-estoque";
import type { LinhaRelatorioEstoque } from "@/lib/relatorio-estoque";
import type { LinhaVendaProduto } from "@/lib/relatorio-estoque";
import type { TotaisControleProduto } from "@/lib/relatorio-estoque";
import type { TotaisPosicaoEstoque } from "@/lib/relatorio-estoque";
import type { TotaisVendaProduto } from "@/lib/relatorio-estoque";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import type { OpcaoRelatorioEstoque } from "@/lib/relatorio-estoque";

function periodoLabel(dataInicio: string, dataFim: string) {
  return `${dataInicio || "—"} à ${dataFim || "—"}`;
}

const TITULOS: Record<OpcaoRelatorioEstoque, string> = {
  controle_produtos: "Controle de Produtos",
  venda_produtos: "Relatório Venda de Produtos",
  movimentacao_agrupado: "Movimentação de Estoque (Agrupado)",
  movimentacao: "Movimentação do Estoque",
};

export async function gerarRelatorioEstoquePdf(
  modo: OpcaoRelatorioEstoque,
  dataInicio: string,
  dataFim: string,
  dados:
    | { tipo: "controle"; linhas: LinhaControleProduto[]; totais: TotaisControleProduto }
    | { tipo: "venda"; linhas: LinhaVendaProduto[]; totais: TotaisVendaProduto }
    | { tipo: "agrupado"; linhas: LinhaPosicaoEstoque[]; totais: TotaisPosicaoEstoque }
    | { tipo: "movimentacao"; linhas: LinhaRelatorioEstoque[] }
) {
  const periodo = periodoLabel(dataInicio, dataFim);
  const titulo = TITULOS[modo];

  if (dados.tipo === "controle") {
    return gerarRelatorioTabelaPdf({
      tituloRelatorio: titulo,
      periodoTexto: periodo,
      colunas: [
        { titulo: "Código", larguraMm: 18, alinhamento: "left" },
        { titulo: "Produto", larguraMm: 36, alinhamento: "left" },
        { titulo: "Marca", larguraMm: 22, alinhamento: "left" },
        { titulo: "Estoque", larguraMm: 22, alinhamento: "right" },
        { titulo: "Mín", larguraMm: 14, alinhamento: "right" },
        { titulo: "Máx", larguraMm: 14, alinhamento: "right" },
        { titulo: "Custo", larguraMm: 22, alinhamento: "right" },
        { titulo: "Venda", larguraMm: 22, alinhamento: "right" },
        { titulo: "Total", larguraMm: 22, alinhamento: "right" },
      ],
      linhas: dados.linhas.map((l) => [
        l.codigo,
        l.produto,
        l.marca,
        l.estoqueAtualLabel,
        l.minimoLabel,
        l.maximoLabel,
        moneyRelatorioEstoque(l.custo),
        moneyRelatorioEstoque(l.venda),
        moneyRelatorioEstoque(l.total),
      ]),
      linhaTotal: {
        indiceRotulo: 5,
        rotulo: "TOTAL",
        celulas: [null, null, null, null, null, null, null, null, moneyRelatorioEstoque(dados.totais.totalGeral)],
      },
    });
  }

  if (dados.tipo === "venda") {
    return gerarRelatorioTabelaPdf({
      tituloRelatorio: titulo,
      periodoTexto: periodo,
      colunas: [
        { titulo: "Data entregue", larguraMm: 28, alinhamento: "left" },
        { titulo: "Qtd", larguraMm: 16, alinhamento: "right" },
        { titulo: "Produto", larguraMm: 48, alinhamento: "left" },
        { titulo: "Marca", larguraMm: 24, alinhamento: "left" },
        { titulo: "Custo", larguraMm: 26, alinhamento: "right" },
        { titulo: "Venda", larguraMm: 26, alinhamento: "right" },
        { titulo: "Lucro", larguraMm: 26, alinhamento: "right" },
      ],
      linhas: dados.linhas.map((l) => [
        l.dataEntregue,
        l.quantidadeLabel,
        l.produto,
        l.marca,
        moneyRelatorioEstoque(l.valorCusto),
        moneyRelatorioEstoque(l.venda),
        moneyRelatorioEstoque(l.lucro),
      ]),
      linhaTotal: {
        indiceRotulo: 3,
        rotulo: "TOTAL",
        celulas: [
          null,
          null,
          null,
          null,
          moneyRelatorioEstoque(dados.totais.valorCusto),
          moneyRelatorioEstoque(dados.totais.venda),
          moneyRelatorioEstoque(dados.totais.lucro),
        ],
      },
    });
  }

  if (dados.tipo === "agrupado") {
    return gerarRelatorioTabelaPdf({
      tituloRelatorio: titulo,
      periodoTexto: periodo,
      colunas: [
        { titulo: "Produto", larguraMm: 40, alinhamento: "left" },
        { titulo: "Marca", larguraMm: 22, alinhamento: "left" },
        { titulo: "Entradas", larguraMm: 20, alinhamento: "right" },
        { titulo: "Saídas", larguraMm: 20, alinhamento: "right" },
        { titulo: "Estoque", larguraMm: 24, alinhamento: "right" },
        { titulo: "V. Unit.", larguraMm: 26, alinhamento: "right" },
        { titulo: "Valor", larguraMm: 26, alinhamento: "right" },
      ],
      linhas: dados.linhas.map((l) => [
        l.produto,
        l.marca,
        String(l.entradas),
        String(l.saidas),
        l.estoqueAtualLabel,
        moneyRelatorioEstoque(l.valorUnitario),
        moneyRelatorioEstoque(l.valor),
      ]),
      linhaTotal: {
        indiceRotulo: 0,
        rotulo: "TOTAIS",
        celulas: [
          "TOTAIS",
          null,
          String(dados.totais.entradas),
          String(dados.totais.saidas),
          null,
          null,
          moneyRelatorioEstoque(dados.totais.valor),
        ],
      },
    });
  }

  return gerarRelatorioTabelaPdf({
    tituloRelatorio: titulo,
    periodoTexto: periodo,
    colunas: [
      { titulo: "Data", larguraMm: 32, alinhamento: "left" },
      { titulo: "Tipo", larguraMm: 18, alinhamento: "center" },
      { titulo: "Produto", larguraMm: 44, alinhamento: "left" },
      { titulo: "Qtd", larguraMm: 16, alinhamento: "right" },
      { titulo: "Setor", larguraMm: 28, alinhamento: "left" },
      { titulo: "Colaborador", larguraMm: 36, alinhamento: "left" },
    ],
    linhas: dados.linhas.map((l) => [
      l.dataLabel,
      l.tipo,
      l.produto,
      l.quantidadeLabel,
      l.setor,
      l.colaborador,
    ]),
  });
}
