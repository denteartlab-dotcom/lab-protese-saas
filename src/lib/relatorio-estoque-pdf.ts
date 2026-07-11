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
import {
  iniciarImpressaoRelatorio,
  periodoRelatorioTexto,
  pl,
} from "@/lib/i18n/print-relatorio-helpers";

function periodoLabel(dataInicio: string, dataFim: string) {
  return periodoRelatorioTexto(dataInicio || "—", dataFim || "—");
}

function tituloEstoque(modo: OpcaoRelatorioEstoque) {
  const chaves = {
    controle_produtos: "print.relatorio.estoque.controleProdutos",
    venda_produtos: "print.relatorio.estoque.vendaProdutos",
    movimentacao_agrupado: "print.relatorio.estoque.movimentacaoAgrupado",
    movimentacao: "print.relatorio.estoque.movimentacao",
  } as const;
  return pl(chaves[modo]);
}

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
  iniciarImpressaoRelatorio();
  const periodo = periodoLabel(dataInicio, dataFim);
  const titulo = tituloEstoque(modo);

  if (dados.tipo === "controle") {
    return gerarRelatorioTabelaPdf({
      tituloRelatorio: titulo,
      periodoTexto: periodo,
      colunas: [
        { titulo: pl("print.relatorio.estoque.codigo"), larguraMm: 18, alinhamento: "left" },
        { titulo: pl("print.relatorio.estoque.produto"), larguraMm: 36, alinhamento: "left" },
        { titulo: pl("print.relatorio.estoque.marca"), larguraMm: 22, alinhamento: "left" },
        { titulo: pl("print.relatorio.estoque.estoque"), larguraMm: 22, alinhamento: "right" },
        { titulo: pl("print.relatorio.estoque.min"), larguraMm: 14, alinhamento: "right" },
        { titulo: pl("print.relatorio.estoque.max"), larguraMm: 14, alinhamento: "right" },
        { titulo: pl("print.relatorio.estoque.custo"), larguraMm: 22, alinhamento: "right" },
        { titulo: pl("print.relatorio.estoque.venda"), larguraMm: 22, alinhamento: "right" },
        { titulo: pl("print.relatorio.total"), larguraMm: 22, alinhamento: "right" },
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
        rotulo: pl("print.relatorio.total"),
        celulas: [null, null, null, null, null, null, null, null, moneyRelatorioEstoque(dados.totais.totalGeral)],
      },
    });
  }

  if (dados.tipo === "venda") {
    return gerarRelatorioTabelaPdf({
      tituloRelatorio: titulo,
      periodoTexto: periodo,
      colunas: [
        { titulo: pl("print.relatorio.estoque.dataEntregue"), larguraMm: 28, alinhamento: "left" },
        { titulo: pl("print.extrato.qtd"), larguraMm: 16, alinhamento: "right" },
        { titulo: pl("print.relatorio.estoque.produto"), larguraMm: 48, alinhamento: "left" },
        { titulo: pl("print.relatorio.estoque.marca"), larguraMm: 24, alinhamento: "left" },
        { titulo: pl("print.relatorio.estoque.custo"), larguraMm: 26, alinhamento: "right" },
        { titulo: pl("print.relatorio.estoque.venda"), larguraMm: 26, alinhamento: "right" },
        { titulo: pl("print.relatorio.estoque.lucro"), larguraMm: 26, alinhamento: "right" },
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
        rotulo: pl("print.relatorio.total"),
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
    const rotuloTotais = pl("print.relatorio.estoque.totais");
    return gerarRelatorioTabelaPdf({
      tituloRelatorio: titulo,
      periodoTexto: periodo,
      colunas: [
        { titulo: pl("print.relatorio.estoque.produto"), larguraMm: 40, alinhamento: "left" },
        { titulo: pl("print.relatorio.estoque.marca"), larguraMm: 22, alinhamento: "left" },
        { titulo: pl("print.relatorio.estoque.entradas"), larguraMm: 20, alinhamento: "right" },
        { titulo: pl("print.relatorio.estoque.saidas"), larguraMm: 20, alinhamento: "right" },
        { titulo: pl("print.relatorio.estoque.estoque"), larguraMm: 24, alinhamento: "right" },
        { titulo: pl("print.relatorio.estoque.valorUnit"), larguraMm: 26, alinhamento: "right" },
        { titulo: pl("print.relatorio.estoque.valor"), larguraMm: 26, alinhamento: "right" },
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
        rotulo: rotuloTotais,
        celulas: [
          rotuloTotais,
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
      { titulo: pl("print.relatorio.estoque.data"), larguraMm: 32, alinhamento: "left" },
      { titulo: pl("print.relatorio.estoque.tipo"), larguraMm: 18, alinhamento: "center" },
      { titulo: pl("print.relatorio.estoque.produto"), larguraMm: 44, alinhamento: "left" },
      { titulo: pl("print.extrato.qtd"), larguraMm: 16, alinhamento: "right" },
      { titulo: pl("print.relatorio.estoque.setor"), larguraMm: 28, alinhamento: "left" },
      { titulo: pl("print.relatorio.estoque.colaborador"), larguraMm: 36, alinhamento: "left" },
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
