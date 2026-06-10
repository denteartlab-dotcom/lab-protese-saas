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
} from "@/lib/relatorio-entregas";
import type { LinhaRelatorioProducao } from "@/lib/relatorio-producao";
import {
  STATUS_TEMPO_PRODUCAO,
  PRIORIDADE_TEMPO_PRODUCAO,
  type LinhaTempoProducao,
} from "@/lib/tempo-producao-relatorio";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function gerarCurvaAbcClientesPdf(
  resultado: ResultadoCurvaAbcClientes,
  periodoTexto: string
) {
  const linhas: string[][] = [];
  for (const secao of resultado.secoes) {
    linhas.push([`Classe ${secao.classe} (${secao.metaPercentual}%)`, "", ""]);
    for (const l of secao.linhas) {
      linhas.push([
        l.cliente,
        formatarPercentualCurvaAbc(l.percentual),
        money(l.valor),
      ]);
    }
    linhas.push([
      `Subtotal ${secao.classe}`,
      "",
      money(secao.subtotal),
    ]);
  }

  return gerarRelatorioTabelaPdf({
    tituloRelatorio: "Curva ABC Clientes",
    periodoTexto,
    colunas: [
      { titulo: "Cliente", larguraMm: 88, alinhamento: "left" },
      { titulo: "%", larguraMm: 28, alinhamento: "center" },
      { titulo: "Valor", larguraMm: 60, alinhamento: "right" },
    ],
    linhas,
    linhaTotal: {
      indiceRotulo: 0,
      rotulo: "TOTAL",
      celulas: ["TOTAL", "", money(resultado.total)],
    },
  });
}

export async function gerarRelatorioProducaoPdf(
  linhas: LinhaRelatorioProducao[],
  titulo: string,
  periodoTexto: string
) {
  const corpo = linhas.filter((l) => l.tipo === "dados");
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: titulo,
    periodoTexto,
    colunas: [
      { titulo: "Data", larguraMm: 26, alinhamento: "left" },
      { titulo: "OS", larguraMm: 14, alinhamento: "center" },
      { titulo: "Descrição", larguraMm: 44, alinhamento: "left" },
      { titulo: "Cliente", larguraMm: 32, alinhamento: "left" },
      { titulo: "Paciente", larguraMm: 32, alinhamento: "left" },
      { titulo: "Situação", larguraMm: 24, alinhamento: "center" },
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
  if (modeloEhExtratoIndividual(modelo) || modeloEhExtrato2Individual(modelo)) {
    return pdfExtratoFinanceiroIndividual(linhas, opcoes, modelo);
  }

  if (modeloEhExtrato3Paciente(modelo)) {
    return pdfExtratoFinanceiroPorPaciente(linhas, opcoes);
  }

  const totalValor = linhas.reduce((s, l) => s + l.valor, 0);
  const totalRecebido = linhas.reduce((s, l) => s + l.recebido, 0);
  const totalSaldo = linhas.reduce((s, l) => s + l.saldo, 0);
  const titulo = `Relatório Receitas — ${tituloModelo}`;

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
      { titulo: "Venc.", larguraMm: 20, alinhamento: "left" },
      { titulo: "Fatura", larguraMm: 14, alinhamento: "center" },
      { titulo: "Parc.", larguraMm: 14, alinhamento: "center" },
      { titulo: "Cliente", larguraMm: 32, alinhamento: "left" },
      { titulo: "OS", larguraMm: 16, alinhamento: "left" },
      { titulo: "Forma", larguraMm: 22, alinhamento: "left" },
      { titulo: "Valor", larguraMm: 20, alinhamento: "right" },
      { titulo: "Saldo", larguraMm: 20, alinhamento: "right" },
      { titulo: "Sit.", larguraMm: 18, alinhamento: "center" },
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
      rotulo: "Totais",
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
    tituloRelatorio: `Relatório Despesas — ${tituloModelo}`,
    periodoTexto: periodoLabel,
    colunas: [
      { titulo: "Vencimento", larguraMm: 24, alinhamento: "left" },
      { titulo: "Nome", larguraMm: 36, alinhamento: "left" },
      { titulo: "Categoria", larguraMm: 28, alinhamento: "left" },
      { titulo: "Forma", larguraMm: 24, alinhamento: "left" },
      { titulo: "Valor", larguraMm: 24, alinhamento: "right" },
      { titulo: "Situação", larguraMm: 22, alinhamento: "center" },
    ],
    linhas: linhas.map((l) => [
      l.vencimento,
      l.nome,
      l.categoria,
      l.formaPagamento,
      money(l.valor),
      l.status === "pago" ? "Pago" : "Pendente",
    ]),
    linhaTotal: {
      indiceRotulo: 3,
      rotulo: "Total",
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
  const total = linhas.reduce((s, l) => s + l.valor, 0);

  if (modelo === "entregas-modelo-3") {
    return gerarRelatorioTabelaPdf({
      tituloRelatorio: `Relatório Entregas — ${tituloModelo}`,
      periodoTexto: periodoLabel,
      colunas: [
        { titulo: "Data Pedido", larguraMm: 22, alinhamento: "left" },
        { titulo: "Destinatário", larguraMm: 28, alinhamento: "left" },
        { titulo: "Entregador", larguraMm: 22, alinhamento: "left" },
        { titulo: "OS", larguraMm: 12, alinhamento: "center" },
        { titulo: "Sit. OS", larguraMm: 18, alinhamento: "center" },
        { titulo: "Cliente OS", larguraMm: 24, alinhamento: "left" },
        { titulo: "Situação", larguraMm: 18, alinhamento: "center" },
        { titulo: "Valor", larguraMm: 20, alinhamento: "right" },
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
        rotulo: "Total",
        celulas: [null, null, null, null, null, null, "Total", money(total)],
      },
    });
  }

  if (modelo === "entregas-modelo-2") {
    const rowsPdf: string[][] = [];
    for (const [entregador, grupo] of agruparPorEntregador(linhas)) {
      rowsPdf.push([`Entregador: ${entregador}`, "", "", "", "", ""]);
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
      tituloRelatorio: `Relatório Entregas — ${tituloModelo}`,
      periodoTexto: periodoLabel,
      colunas: [
        { titulo: "Data Pedido", larguraMm: 28, alinhamento: "left" },
        { titulo: "Destinatário", larguraMm: 32, alinhamento: "left" },
        { titulo: "Descrição", larguraMm: 36, alinhamento: "left" },
        { titulo: "Situação", larguraMm: 22, alinhamento: "center" },
        { titulo: "Valor", larguraMm: 24, alinhamento: "right" },
        { titulo: "OS", larguraMm: 16, alinhamento: "center" },
      ],
      linhas: rowsPdf,
      linhaTotal: {
        indiceRotulo: 3,
        rotulo: "Total",
        celulas: [null, null, null, "Total", money(total), null],
      },
    });
  }

  return gerarRelatorioTabelaPdf({
    tituloRelatorio: `Relatório Entregas — ${tituloModelo}`,
    periodoTexto: periodoLabel,
    colunas: [
      { titulo: "Data Pedido", larguraMm: 28, alinhamento: "left" },
      { titulo: "Destinatário", larguraMm: 32, alinhamento: "left" },
      { titulo: "Entregador", larguraMm: 28, alinhamento: "left" },
      { titulo: "Descrição", larguraMm: 36, alinhamento: "left" },
      { titulo: "Situação", larguraMm: 22, alinhamento: "center" },
      { titulo: "Valor", larguraMm: 24, alinhamento: "right" },
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
      rotulo: "Total",
      celulas: [null, null, null, null, "Total", money(total)],
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
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: "Margem de Contribuição",
    periodoTexto,
    colunas: [
      { titulo: "Categoria", larguraMm: 40, alinhamento: "left" },
      { titulo: "Nome", larguraMm: 48, alinhamento: "left" },
      { titulo: "Valor", larguraMm: 28, alinhamento: "right" },
      { titulo: "Custo", larguraMm: 28, alinhamento: "right" },
      { titulo: "Margem", larguraMm: 28, alinhamento: "right" },
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
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: "Tempo de Produção",
    periodoTexto,
    colunas: [
      { titulo: "OS", larguraMm: 12, alinhamento: "center" },
      { titulo: "Paciente", larguraMm: 28, alinhamento: "left" },
      { titulo: "Etapa", larguraMm: 24, alinhamento: "left" },
      { titulo: "Colab.", larguraMm: 20, alinhamento: "left" },
      { titulo: "Resp.", larguraMm: 20, alinhamento: "left" },
      { titulo: "Lab.", larguraMm: 10, alinhamento: "center" },
      { titulo: "Parado", larguraMm: 10, alinhamento: "center" },
      { titulo: "Atraso", larguraMm: 10, alinhamento: "center" },
      { titulo: "Status", larguraMm: 20, alinhamento: "center" },
      { titulo: "Prior.", larguraMm: 16, alinhamento: "center" },
    ],
    linhas: linhas.map((l) => [
      String(l.numeroOs),
      l.paciente,
      l.etapaAtual,
      l.colaborador,
      l.responsavelPeloAtraso,
      String(l.diasNoLaboratorio),
      `${l.diasNaEtapaAtual}d`,
      l.diasAtraso > 0 ? `${l.diasAtraso}d` : "—",
      STATUS_TEMPO_PRODUCAO[l.status].label,
      PRIORIDADE_TEMPO_PRODUCAO[l.prioridade].label,
    ]),
  });
}
