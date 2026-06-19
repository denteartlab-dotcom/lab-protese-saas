import { baixarCsv } from "@/lib/exportar-csv";
import { baixarExcel } from "@/lib/exportar-excel";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import type {
  FiltrosRelatorioFinanceiroGeral,
  RelatorioFinanceiroGeralPayload,
} from "@/lib/relatorio-financeiro-geral";
import {
  formatarMoedaFinanceiroGeral,
  formatarPercentualFinanceiroGeral,
  periodoTextoFinanceiroGeral,
} from "@/lib/relatorio-financeiro-geral";

function moeda(valor: number) {
  return formatarMoedaFinanceiroGeral(valor);
}

export async function exportarRelatorioFinanceiroGeralPdf(
  dados: RelatorioFinanceiroGeralPayload,
  filtros: FiltrosRelatorioFinanceiroGeral
) {
  const linhasMes = dados.tabelaPorMes.map((m) => [
    `${m.mes}/${m.ano}`,
    moeda(m.naoConcluido),
    moeda(m.concluido),
    moeda(m.total),
    String(m.quantidade),
    moeda(m.ticketMedio),
  ]);

  const totalMes = dados.tabelaPorMes.reduce(
    (acc, m) => ({
      nao: acc.nao + m.naoConcluido,
      sim: acc.sim + m.concluido,
      total: acc.total + m.total,
      qtd: acc.qtd + m.quantidade,
    }),
    { nao: 0, sim: 0, total: 0, qtd: 0 }
  );

  return gerarRelatorioTabelaPdf({
    tituloRelatorio: "Relatório Financeiro Geral",
    periodoTexto: periodoTextoFinanceiroGeral(filtros),
    colunas: [
      { titulo: "Mês", larguraMm: 18 },
      { titulo: "Não Concl.", larguraMm: 24, alinhamento: "right" },
      { titulo: "Concluído", larguraMm: 24, alinhamento: "right" },
      { titulo: "Total", larguraMm: 24, alinhamento: "right" },
      { titulo: "Qtd", larguraMm: 12, alinhamento: "center" },
      { titulo: "Ticket", larguraMm: 24, alinhamento: "right" },
    ],
    linhas: [
      ...linhasMes,
      ...dados.detalhes.slice(0, 40).map((d) => [
        String(d.numeroOs),
        d.cliente,
        d.servico,
        moeda(d.valor),
        d.dataEntrada,
        d.statusLabel,
      ]),
    ],
    linhaTotal: {
      indiceRotulo: 0,
      rotulo: "TOTAL",
      celulas: [
        "TOTAL",
        moeda(totalMes.nao),
        moeda(totalMes.sim),
        moeda(totalMes.total),
        String(totalMes.qtd),
        moeda(dados.resumo.ticketMedio),
      ],
    },
  });
}

export function exportarRelatorioFinanceiroGeralExcel(
  dados: RelatorioFinanceiroGeralPayload,
  filtros: FiltrosRelatorioFinanceiroGeral
) {
  const periodo = periodoTextoFinanceiroGeral(filtros).replace(/\//g, "-");
  void baixarExcel(
    `relatorio-financeiro-geral-${periodo}`,
    [
      "Número OS",
      "Cliente",
      "Serviço",
      "Valor",
      "Data Entrada",
      "Prazo",
      "Dias Produção",
      "Status",
      "Etapa Atual",
      "Responsável",
    ],
    dados.detalhes.map((d) => [
      d.numeroOs,
      d.cliente,
      d.servico,
      d.valor,
      d.dataEntrada,
      d.prazo,
      d.diasProducao,
      d.statusLabel,
      d.etapaAtual,
      d.responsavel,
    ]),
    { nomeAba: "Serviços" }
  );
}

export function exportarRelatorioFinanceiroGeralCsv(
  dados: RelatorioFinanceiroGeralPayload,
  filtros: FiltrosRelatorioFinanceiroGeral
) {
  const periodo = periodoTextoFinanceiroGeral(filtros).replace(/\//g, "-");
  baixarCsv(
    `relatorio-financeiro-geral-${periodo}.csv`,
    [
      "Mês",
      "Valor Não Concluído",
      "Valor Concluído",
      "Valor Total",
      "Quantidade",
      "Ticket Médio",
    ],
    dados.tabelaPorMes.map((m) => [
      `${m.mes}/${m.ano}`,
      m.naoConcluido,
      m.concluido,
      m.total,
      m.quantidade,
      m.ticketMedio,
    ])
  );
}

export function resumoExportacaoFinanceiroGeral(dados: RelatorioFinanceiroGeralPayload) {
  return [
    ["Valor Bruto Total (OS)", moeda(dados.resumo.valorBrutoTotal)],
    ["Quantidade Total", String(dados.resumo.quantidadeTotal)],
    ["Ticket Médio", moeda(dados.resumo.ticketMedio)],
    ["Valor Médio Mensal", moeda(dados.resumo.valorMedioMensal)],
    ["Não Concluídos (qtd)", String(dados.resumo.naoConcluidosQtd)],
    ["Não Concluídos (valor)", moeda(dados.resumo.naoConcluidosValor)],
    ["Concluídos (qtd)", String(dados.resumo.concluidosQtd)],
    ["Concluídos (valor)", moeda(dados.resumo.concluidosValor)],
    ["Receitas realizadas", moeda(dados.financeiroRealizado.resumo.receitasTotal)],
    ["Despesas realizadas", moeda(dados.financeiroRealizado.resumo.despesasTotal)],
    ["Saldo realizado", moeda(dados.financeiroRealizado.resumo.saldoTotal)],
    ...dados.tabelaPorTipo.map((t) => [
      `${t.servico} — %`,
      formatarPercentualFinanceiroGeral(t.percentual),
    ]),
  ];
}
