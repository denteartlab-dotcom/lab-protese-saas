import { formatarPercentualCurvaAbc, type ResultadoCurvaAbcClientes } from "@/lib/curva-abc-clientes";
import type { LinhaRelatorioDespesa } from "@/lib/relatorio-despesas";
import type {
  LinhaRelatorioContasReceber,
  OpcoesImpressaoRelatorioReceitas,
} from "@/lib/relatorio-contas-receber";
import {
  modeloEhExtrato3Paciente,
  modeloEhExtrato2Individual,
  modeloEhExtratoIndividual,
  type ModeloRelatorioReceitas,
} from "@/lib/relatorio-receitas-modelos";
import {
  agruparPorEntregador,
  type LinhaRelatorioEntrega,
  type ModeloRelatorioEntregas,
} from "@/lib/relatorio-entregas-tipos";
import type { LinhaRelatorioProducao } from "@/lib/relatorio-producao";
import {
  STATUS_TEMPO_PRODUCAO,
  PRIORIDADE_TEMPO_PRODUCAO,
  type LinhaTempoProducao,
} from "@/lib/tempo-producao-relatorio";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import {
  iniciarImpressaoRelatorio,
  moneyRelatorio,
  pl,
  tituloPeriodoCampo,
} from "@/lib/i18n/print-relatorio-helpers";
import { formatDate, normalizarColaborador } from "@/lib/utils";

function money(value: number) {
  return moneyRelatorio(value);
}

export async function gerarCurvaAbcClientesPdf(
  resultado: ResultadoCurvaAbcClientes,
  periodoTexto: string
) {
  iniciarImpressaoRelatorio();
  const linhas: string[][] = [];
  for (const secao of resultado.secoes) {
    linhas.push([pl("print.relatorio.col.classeSecao", { classe: secao.classe, percentual: secao.metaPercentual }), "", ""]);
    for (const l of secao.linhas) {
      linhas.push([
        l.cliente,
        formatarPercentualCurvaAbc(l.percentual),
        money(l.valor),
      ]);
    }
    linhas.push([
      pl("print.relatorio.subtotalClasse", { classe: secao.classe }),
      "",
      money(secao.subtotal),
    ]);
  }

  return gerarRelatorioTabelaPdf({
    tituloRelatorio: pl("print.relatorio.curvaAbc"),
    periodoTexto,
    colunas: [
      { titulo: pl("print.relatorio.cliente"), larguraMm: 88, alinhamento: "left" },
      { titulo: "%", larguraMm: 28, alinhamento: "center" },
      { titulo: pl("print.relatorio.col.valor"), larguraMm: 60, alinhamento: "right" },
    ],
    linhas,
    linhaTotal: {
      indiceRotulo: 0,
      rotulo: pl("print.relatorio.total"),
      celulas: [pl("print.relatorio.total"), "", money(resultado.total)],
    },
  });
}

export async function gerarRelatorioProducaoPdf(
  linhas: LinhaRelatorioProducao[],
  titulo: string,
  periodoTexto: string
) {
  iniciarImpressaoRelatorio();
  const corpo = linhas.filter((l) => l.tipo === "dados");
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: titulo,
    periodoTexto,
    colunas: [
      { titulo: pl("print.extrato.data"), larguraMm: 26, alinhamento: "left" },
      { titulo: pl("print.extrato.os"), larguraMm: 14, alinhamento: "center" },
      { titulo: pl("print.relatorio.col.descricao"), larguraMm: 44, alinhamento: "left" },
      { titulo: pl("print.relatorio.cliente"), larguraMm: 32, alinhamento: "left" },
      { titulo: pl("print.extrato.paciente"), larguraMm: 32, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.situacao"), larguraMm: 24, alinhamento: "center" },
    ],
    linhas: corpo.map((l) => [
      l.data,
      l.os === "" ? "" : String(l.os),
      l.descricao,
      l.cliente,
      l.paciente,
      l.situacao,
    ]),
  });
}

async function pdfExtratoFinanceiroPorPaciente(
  linhas: LinhaRelatorioContasReceber[],
  opcoes?: OpcoesImpressaoRelatorioReceitas
) {
  const { gerarRelatorioExtrato3PacienteSmartPdf } = await import(
    "@/lib/pdf-relatorio-extrato-3-paciente-smart"
  );
  const nomeCliente =
    opcoes?.nomeClienteExtrato?.trim() ||
    linhas[0]?.cliente?.trim() ||
    "Cliente";
  return gerarRelatorioExtrato3PacienteSmartPdf(
    opcoes?.lancamentos ?? [],
    opcoes?.trabalhos ?? [],
    nomeCliente,
    {
      periodoAtivo: opcoes?.periodoAtivo,
      dataInicio: opcoes?.dataInicio,
      dataFinal: opcoes?.dataFinal,
      periodoCampo: opcoes?.periodoCampo,
      clienteId: opcoes?.clienteIdExtrato,
    }
  );
}

async function pdfExtratoFinanceiroIndividual(
  linhas: LinhaRelatorioContasReceber[],
  opcoes?: OpcoesImpressaoRelatorioReceitas,
  modelo: ModeloRelatorioReceitas = "extrato-individual"
) {
  const nomeCliente =
    opcoes?.nomeClienteExtrato?.trim() ||
    linhas[0]?.cliente?.trim() ||
    "Cliente";
  const opcoesPdf = {
    periodoAtivo: opcoes?.periodoAtivo,
    dataInicio: opcoes?.dataInicio,
    dataFinal: opcoes?.dataFinal,
    periodoCampo: opcoes?.periodoCampo,
    clienteId: opcoes?.clienteIdExtrato,
  };
  if (modeloEhExtrato2Individual(modelo)) {
    const { gerarRelatorioExtrato2IndividualSmartPdf } = await import(
      "@/lib/pdf-relatorio-extrato-2-individual-smart"
    );
    return gerarRelatorioExtrato2IndividualSmartPdf(
      opcoes?.lancamentos ?? [],
      opcoes?.trabalhos ?? [],
      nomeCliente,
      opcoesPdf
    );
  }
  const { gerarRelatorioExtratoIndividualSmartPdf } = await import(
    "@/lib/pdf-relatorio-extrato-individual-smart"
  );
  return gerarRelatorioExtratoIndividualSmartPdf(
    opcoes?.lancamentos ?? [],
    opcoes?.trabalhos ?? [],
    nomeCliente,
    opcoesPdf
  );
}

export async function gerarRelatorioContasReceberPdf(
  linhas: LinhaRelatorioContasReceber[],
  tituloModelo: string,
  periodoLabel: string,
  modelo: ModeloRelatorioReceitas,
  opcoes?: OpcoesImpressaoRelatorioReceitas
) {
  iniciarImpressaoRelatorio();
  if (modeloEhExtratoIndividual(modelo) || modeloEhExtrato2Individual(modelo)) {
    return pdfExtratoFinanceiroIndividual(linhas, opcoes, modelo);
  }

  if (modeloEhExtrato3Paciente(modelo)) {
    return pdfExtratoFinanceiroPorPaciente(linhas, opcoes);
  }

  const totalValor = linhas.reduce((s, l) => s + l.valor, 0);
  const totalRecebido = linhas.reduce((s, l) => s + l.recebido, 0);
  const totalSaldo = linhas.reduce((s, l) => s + l.saldo, 0);
  const titulo = pl("print.relatorio.tituloReceitas", { modelo: tituloModelo });

  if (opcoes) {
    const periodoPdf = {
      periodoCampo: opcoes.periodoCampo,
      dataInicio: opcoes.periodoAtivo ? opcoes.dataInicio : "—",
      dataFinal: opcoes.periodoAtivo ? opcoes.dataFinal : "—",
    };
    if (modelo === "faturas-modelo-1") {
      const { gerarRelatorioFaturasModelo1Pdf } = await import(
        "@/lib/pdf-relatorio-faturas-modelo1"
      );
      return gerarRelatorioFaturasModelo1Pdf(linhas, periodoPdf);
    }
    if (modelo === "faturas-modelo-2") {
      const { gerarRelatorioFaturasModelo2Pdf } = await import(
        "@/lib/pdf-relatorio-faturas-modelo2"
      );
      return gerarRelatorioFaturasModelo2Pdf(linhas, periodoPdf);
    }
    if (modelo === "faturas-modelo-3") {
      const { gerarRelatorioFaturasModelo3Pdf } = await import(
        "@/lib/pdf-relatorio-faturas-modelo3"
      );
      return gerarRelatorioFaturasModelo3Pdf(
        linhas,
        periodoPdf,
        opcoes.lancamentos ?? [],
        opcoes.trabalhos ?? []
      );
    }
    if (modelo === "parcelas-a-receber-modelo-1") {
      const { gerarRelatorioParcelasAReceberModelo1Pdf } = await import(
        "@/lib/pdf-relatorio-parcelas-a-receber-modelo1"
      );
      return gerarRelatorioParcelasAReceberModelo1Pdf(linhas, {
        ...periodoPdf,
        somenteAReceber: opcoes.parcelasSomenteAReceber,
      });
    }
    if (modelo === "parcelas-a-receber-modelo-2") {
      const { gerarRelatorioParcelasAReceberModelo2Pdf } = await import(
        "@/lib/pdf-relatorio-parcelas-a-receber-modelo2"
      );
      return gerarRelatorioParcelasAReceberModelo2Pdf(linhas, {
        ...periodoPdf,
        somenteAReceber: opcoes.parcelasSomenteAReceber,
        agruparPorCliente: opcoes.parcelasAgruparPorCliente,
      });
    }
    if (modelo === "recebimentos") {
      const { gerarRelatorioRecebimentosSmartPdf } = await import(
        "@/lib/pdf-relatorio-recebimentos-smart"
      );
      return gerarRelatorioRecebimentosSmartPdf(linhas, {
        ...periodoPdf,
        agruparPorCliente: opcoes.recebimentosAgruparPorCliente,
      });
    }
    if (modelo === "recebimentos-completo") {
      const { gerarRelatorioRecebimentosCompletoSmartPdf } = await import(
        "@/lib/pdf-relatorio-recebimentos-completo-smart"
      );
      return gerarRelatorioRecebimentosCompletoSmartPdf(linhas, {
        ...periodoPdf,
        periodoAtivo: opcoes.periodoAtivo,
        ordenarPor: opcoes.ordenarPor,
      });
    }
  }

  if (modelo === "recebimentos") {
    const { gerarRelatorioRecebimentosSmartPdf } = await import(
      "@/lib/pdf-relatorio-recebimentos-smart"
    );
    return gerarRelatorioRecebimentosSmartPdf(linhas, {
      periodoCampo: "data_lancamento",
      dataInicio: "—",
      dataFinal: "—",
    });
  }

  if (modelo === "recebimentos-completo") {
    const { gerarRelatorioRecebimentosCompletoSmartPdf } = await import(
      "@/lib/pdf-relatorio-recebimentos-completo-smart"
    );
    return gerarRelatorioRecebimentosCompletoSmartPdf(linhas, {
      periodoCampo: "data_lancamento",
      dataInicio: "—",
      dataFinal: "—",
      periodoAtivo: false,
    });
  }

  // faturas-modelo-1 (padrão)
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: titulo,
    periodoTexto: periodoLabel,
    colunas: [
      { titulo: pl("print.relatorio.col.venc"), larguraMm: 20, alinhamento: "left" },
      { titulo: pl("print.extrato.fatura"), larguraMm: 14, alinhamento: "center" },
      { titulo: pl("print.relatorio.col.parcelaAbrev"), larguraMm: 14, alinhamento: "center" },
      { titulo: pl("print.relatorio.cliente"), larguraMm: 32, alinhamento: "left" },
      { titulo: pl("print.extrato.os"), larguraMm: 16, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.forma"), larguraMm: 22, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.valor"), larguraMm: 20, alinhamento: "right" },
      { titulo: pl("print.relatorio.col.saldo"), larguraMm: 20, alinhamento: "right" },
      { titulo: pl("print.relatorio.col.sit"), larguraMm: 18, alinhamento: "center" },
    ],
    linhas: linhas.map((l) => [
      l.vencimento,
      String(l.numeroFatura),
      l.parcela,
      l.cliente,
      l.os,
      l.formaRecebimento,
      money(l.valor),
      money(l.saldo),
      l.situacao,
    ]),
    linhaTotal: {
      indiceRotulo: 5,
      rotulo: pl("print.relatorio.totais"),
      celulas: [
        null,
        null,
        null,
        null,
        null,
        null,
        money(totalValor),
        money(totalSaldo),
        null,
      ],
    },
  });
}

export type OpcoesGerarRelatorioDespesasPdf = {
  modelo: string;
  periodoCampo: "data_lancamento" | "vencimento";
  dataInicio: string;
  dataFinal: string;
};

export async function gerarRelatorioDespesasPdf(
  linhas: LinhaRelatorioDespesa[],
  tituloModelo: string,
  periodoLabel: string,
  opcoes?: OpcoesGerarRelatorioDespesasPdf
) {
  iniciarImpressaoRelatorio();
  if (opcoes?.modelo === "despesas-modelo-1") {
    const { gerarRelatorioDespesasModelo1Pdf } = await import(
      "@/lib/pdf-relatorio-despesas-modelo1"
    );
    return gerarRelatorioDespesasModelo1Pdf(linhas, {
      periodoCampo: opcoes.periodoCampo,
      dataInicio: opcoes.dataInicio,
      dataFinal: opcoes.dataFinal,
    });
  }

  const total = linhas.reduce((s, l) => s + l.valor, 0);
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: pl("print.relatorio.tituloDespesasModelo", { modelo: tituloModelo }),
    periodoTexto: periodoLabel,
    colunas: [
      { titulo: pl("print.relatorio.col.vencimento"), larguraMm: 24, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.nome"), larguraMm: 36, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.categoria"), larguraMm: 28, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.forma"), larguraMm: 24, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.valor"), larguraMm: 24, alinhamento: "right" },
      { titulo: pl("print.relatorio.col.situacao"), larguraMm: 22, alinhamento: "center" },
    ],
    linhas: linhas.map((l) => [
      l.vencimento,
      l.nome,
      l.categoria,
      l.formaPagamento,
      money(l.valor),
      l.status === "pago" ? pl("print.relatorio.situacao.pago") : pl("print.relatorio.situacao.pendente"),
    ]),
    linhaTotal: {
      indiceRotulo: 3,
      rotulo: pl("print.relatorio.total"),
      celulas: [null, null, null, null, money(total), null],
    },
  });
}

export async function gerarRelatorioEntregasPdf(
  linhas: LinhaRelatorioEntrega[],
  tituloModelo: string,
  periodoLabel: string,
  modelo: ModeloRelatorioEntregas
) {
  iniciarImpressaoRelatorio();
  const total = linhas.reduce((s, l) => s + l.valor, 0);

  if (modelo === "entregas-modelo-3") {
    return gerarRelatorioTabelaPdf({
      tituloRelatorio: pl("print.relatorio.entregas.titulo", { modelo: tituloModelo }),
      periodoTexto: periodoLabel,
      colunas: [
        { titulo: pl("print.relatorio.col.dataPedido"), larguraMm: 22, alinhamento: "left" },
        { titulo: pl("print.relatorio.col.destinatario"), larguraMm: 28, alinhamento: "left" },
        { titulo: pl("print.relatorio.col.entregador"), larguraMm: 22, alinhamento: "left" },
        { titulo: pl("print.extrato.os"), larguraMm: 12, alinhamento: "center" },
        { titulo: pl("print.relatorio.col.sitOs"), larguraMm: 18, alinhamento: "center" },
        { titulo: pl("print.relatorio.col.clienteOs"), larguraMm: 24, alinhamento: "left" },
        { titulo: pl("print.relatorio.col.situacao"), larguraMm: 18, alinhamento: "center" },
        { titulo: pl("print.relatorio.col.valor"), larguraMm: 20, alinhamento: "right" },
      ],
      linhas: linhas.map((l) => [
        l.dataPedido,
        l.destinatario,
        l.entregador,
        l.numeroOs,
        l.situacaoOs || "—",
        l.clienteOs || "—",
        l.situacaoLabel,
        money(l.valor),
      ]),
      linhaTotal: {
        indiceRotulo: 6,
        rotulo: pl("print.relatorio.total"),
        celulas: [null, null, null, null, null, null, pl("print.relatorio.total"), money(total)],
      },
    });
  }

  if (modelo === "entregas-modelo-2") {
    const rowsPdf: string[][] = [];
    for (const [entregador, grupo] of agruparPorEntregador(linhas)) {
      rowsPdf.push([pl("print.relatorio.entregas.entregadorGrupo", { nome: entregador }), "", "", "", "", ""]);
      for (const linha of grupo) {
        rowsPdf.push([
          linha.dataPedido,
          linha.destinatario,
          linha.descricao,
          linha.situacaoLabel,
          money(linha.valor),
          linha.numeroOs,
        ]);
      }
    }
    return gerarRelatorioTabelaPdf({
      tituloRelatorio: pl("print.relatorio.entregas.titulo", { modelo: tituloModelo }),
      periodoTexto: periodoLabel,
      colunas: [
        { titulo: pl("print.relatorio.col.dataPedido"), larguraMm: 28, alinhamento: "left" },
        { titulo: pl("print.relatorio.col.destinatario"), larguraMm: 32, alinhamento: "left" },
        { titulo: pl("print.relatorio.col.descricao"), larguraMm: 36, alinhamento: "left" },
        { titulo: pl("print.relatorio.col.situacao"), larguraMm: 22, alinhamento: "center" },
        { titulo: pl("print.relatorio.col.valor"), larguraMm: 24, alinhamento: "right" },
        { titulo: pl("print.extrato.os"), larguraMm: 16, alinhamento: "center" },
      ],
      linhas: rowsPdf,
      linhaTotal: {
        indiceRotulo: 3,
        rotulo: pl("print.relatorio.total"),
        celulas: [null, null, null, pl("print.relatorio.total"), money(total), null],
      },
    });
  }

  return gerarRelatorioTabelaPdf({
    tituloRelatorio: pl("print.relatorio.entregas.titulo", { modelo: tituloModelo }),
    periodoTexto: periodoLabel,
    colunas: [
      { titulo: pl("print.relatorio.col.dataPedido"), larguraMm: 28, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.destinatario"), larguraMm: 32, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.entregador"), larguraMm: 28, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.descricao"), larguraMm: 36, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.situacao"), larguraMm: 22, alinhamento: "center" },
      { titulo: pl("print.relatorio.col.valor"), larguraMm: 24, alinhamento: "right" },
    ],
    linhas: linhas.map((l) => [
      l.dataPedido,
      l.destinatario,
      l.entregador,
      l.descricao,
      l.situacaoLabel,
      money(l.valor),
    ]),
    linhaTotal: {
      indiceRotulo: 4,
      rotulo: pl("print.relatorio.total"),
      celulas: [null, null, null, null, pl("print.relatorio.total"), money(total)],
    },
  });
}

export type LinhaHistoricoEntregaPdf = {
  numeroOs: string;
  destinatario: string;
  descricao: string;
  entregador: string;
  entregueEm: string;
  situacao: string;
  recebedor: string;
  valor: number;
};

export async function gerarHistoricoEntregasPdf(
  linhas: LinhaHistoricoEntregaPdf[],
  periodoTexto: string
) {
  iniciarImpressaoRelatorio();
  const total = linhas.reduce((s, l) => s + l.valor, 0);

  return gerarRelatorioTabelaPdf({
    tituloRelatorio: pl("print.relatorio.entregas.historicoTitulo"),
    periodoTexto,
    colunas: [
      { titulo: pl("print.extrato.os"), larguraMm: 11, alinhamento: "center" },
      { titulo: pl("print.relatorio.col.destinatario"), larguraMm: 24, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.descricao"), larguraMm: 28, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.entregador"), larguraMm: 20, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.entregueEm"), larguraMm: 22, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.situacao"), larguraMm: 24, alinhamento: "center" },
      { titulo: pl("print.relatorio.col.recebedor"), larguraMm: 22, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.valor"), larguraMm: 17, alinhamento: "right" },
    ],
    linhas:
      linhas.length === 0
        ? [["—", pl("print.relatorio.entregas.semDados"), "—", "—", "—", "—", "—", "0,00"]]
        : linhas.map((l) => [
            l.numeroOs,
            l.destinatario,
            l.descricao,
            l.entregador,
            l.entregueEm,
            l.situacao,
            l.recebedor,
            money(l.valor),
          ]),
    linhaTotal: {
      indiceRotulo: 6,
      rotulo: pl("print.relatorio.total"),
      celulas: [null, null, null, null, null, null, pl("print.relatorio.total"), money(total)],
    },
  });
}

export async function gerarMargemContribuicaoPdf(
  linhas: {
    categoria: string;
    nome: string;
    valor: number;
    custo: number;
    margem: number;
  }[],
  periodoTexto: string
) {
  iniciarImpressaoRelatorio();
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: pl("print.relatorio.margemContribuicao"),
    periodoTexto,
    colunas: [
      { titulo: pl("print.relatorio.col.categoria"), larguraMm: 40, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.nome"), larguraMm: 48, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.valor"), larguraMm: 28, alinhamento: "right" },
      { titulo: pl("print.relatorio.custo"), larguraMm: 28, alinhamento: "right" },
      { titulo: pl("print.relatorio.margem"), larguraMm: 28, alinhamento: "right" },
    ],
    linhas: linhas.map((l) => [
      l.categoria,
      l.nome,
      money(l.valor),
      money(l.custo),
      money(l.margem),
    ]),
  });
}

export async function gerarTempoProducaoPdf(
  linhas: LinhaTempoProducao[],
  periodoTexto?: string
) {
  iniciarImpressaoRelatorio();
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: pl("print.relatorio.tempoProducao"),
    periodoTexto,
    colunas: [
      { titulo: pl("print.extrato.os"), larguraMm: 12, alinhamento: "center" },
      { titulo: pl("print.extrato.paciente"), larguraMm: 28, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.etapa"), larguraMm: 24, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.colabAbrev"), larguraMm: 20, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.respAbrev"), larguraMm: 20, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.labAbrev"), larguraMm: 10, alinhamento: "center" },
      { titulo: pl("print.relatorio.col.parado"), larguraMm: 10, alinhamento: "center" },
      { titulo: pl("print.relatorio.col.atraso"), larguraMm: 10, alinhamento: "center" },
      { titulo: pl("print.relatorio.col.situacao"), larguraMm: 20, alinhamento: "center" },
      { titulo: pl("print.relatorio.col.priorAbrev"), larguraMm: 16, alinhamento: "center" },
    ],
    linhas: linhas.map((l) => [
      String(l.numeroOs),
      l.paciente,
      l.etapaAtual,
      normalizarColaborador(l.colaborador),
      normalizarColaborador(l.responsavelPeloAtraso),
      String(l.diasNoLaboratorio),
      `${l.diasNaEtapaAtual}d`,
      l.diasAtraso > 0 ? `${l.diasAtraso}d` : "—",
      STATUS_TEMPO_PRODUCAO[l.status].label,
      PRIORIDADE_TEMPO_PRODUCAO[l.prioridade].label,
    ]),
  });
}
