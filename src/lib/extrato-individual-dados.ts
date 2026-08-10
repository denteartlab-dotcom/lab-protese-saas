import { numerosOsDoLancamentoFatura } from "@/lib/os-faturamento";
import {
  filtrarTrabalhosCliente,
  itensDoTrabalho,
  trabalhosDaFaturaParaExtrato,
  chaveAgrupamentoFatura,
  type TrabalhoRelatorioFatura,
} from "@/lib/relatorio-faturas-modelo3-dados";
import {
  ehDescricaoFaturaContasReceber,
  isCreditoGerado,
  isCreditoUtilizado,
  isRecebimentoParcial,
  movimentacoesRecebimentoDaFatura,
  numeroFaturaDeLancamento,
  observacaoRecebimentoCurta,
  valorRecebidoCashNaFaturaPaga,
  type LancamentoContasReceber,
} from "@/lib/contas-receber-financeiro";
import { calcularCreditoDisponivelClienteFaturaAte } from "@/lib/fatura-cliente-financeiro";
import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import { formatDate } from "@/lib/utils";

export type TipoLinhaExtratoIndividual =
  | "saldo_anterior"
  | "servico"
  | "credito"
  | "pagamento"
  | "desconto";

export type LinhaExtratoIndividual = {
  tipo: TipoLinhaExtratoIndividual;
  dataFatura: string;
  dataOrdem: Date;
  /** Data usada no filtro de período (alinhada ao campo do relatório). */
  dataOrdemPeriodo?: Date;
  numFatura: string;
  os: string;
  servico: string;
  qtd: string;
  paciente: string;
  numDente: string;
  dataEntrega: string;
  valorUn: number;
  desconto: number;
  subtotal: number;
};

export type LinhaExtratoIndividualComSaldo = LinhaExtratoIndividual & {
  saldo: number;
};

export type ResumoExtratoIndividual = {
  saldoAnterior: number;
  /** Adiantamento disponível na abertura do período (para exibir Saldo Anterior em C). */
  creditoAbertura: number;
  totalServicos: number;
  totalPagamentos: number;
  totalDescontos: number;
  saldoTotal: number;
};

function dateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function descricaoBaseReceita(l: LancamentoContasReceber) {
  return desempacotarDespesa(l.descricao).texto;
}

function valorNumerico(valor: unknown) {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string") {
    const n = Number(valor.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function filtrarReceitasCliente(
  lancamentos: LancamentoContasReceber[],
  nomeCliente: string,
  clienteId?: string | null
) {
  const nomeNorm = nomeCliente.trim().toLowerCase();
  return lancamentos.filter((l) => {
    if (l.tipo !== "receita" || l.status === "cancelado") return false;
    if (!l.cliente?.id || !l.cliente.nome?.trim()) return false;
    if (clienteId) return l.cliente.id === clienteId;
    return l.cliente.nome.trim().toLowerCase() === nomeNorm;
  });
}

function dataFaturaLancamento(l: LancamentoContasReceber) {
  const d = l.createdAt ? new Date(l.createdAt) : new Date(l.data);
  return { texto: formatDate(d.toISOString()), ordem: dateOnly(d.toISOString()) };
}

function textoPagamento(l: LancamentoContasReceber) {
  const forma = (l.formaPagamento || "").trim();
  if (!forma) return "Recebimento";
  if (forma.toLowerCase().includes("pix")) {
    if (forma.toLowerCase().includes("interno")) return "Recebimento Pix Interno";
    if (forma.toLowerCase().includes("externo")) return "Recebimento Pix Externo";
    return `Recebimento ${forma}`;
  }
  if (/abatimento|cr[eé]dito/i.test(forma)) return "Abatimento de crédito";
  return `Recebimento ${forma}`;
}

/** Só Cobrança OS / Cobrança sem O.S. de Contas a Receber — ignora OS # legado. */
function ehFaturaContasReceberExtrato(l: LancamentoContasReceber) {
  return ehDescricaoFaturaContasReceber(descricaoBaseReceita(l));
}

function ehLinhaAbatimentoCredito(linha: Pick<LinhaExtratoIndividual, "tipo" | "servico">) {
  if (linha.tipo !== "pagamento") return false;
  return /abatimento|cr[eé]dito/i.test(linha.servico);
}

/** Itens da Cobrança no extrato — valor da fatura é a fonte da verdade. */
function linhasServicoDaFaturaExtrato(
  l: LancamentoContasReceber,
  relacionados: ReturnType<typeof trabalhosDaFaturaParaExtrato>,
  base: {
    dataFatura: string;
    dataOrdem: Date;
    dataOrdemPeriodo: Date;
    numFatura: string;
  }
): LinhaExtratoIndividual[] {
  const valorFatura = valorNumerico(l.valor);
  const itens =
    relacionados.length > 0
      ? relacionados.flatMap((t) =>
          itensDoTrabalho(t).map((item) => ({
            ...item,
            dataEntrega: dataEntregaTrabalho(t),
          }))
        )
      : [];
  const somaItens = itens.reduce((s, item) => s + item.subtotal, 0);

  if (itens.length > 0 && somaItens > 0.009) {
    const fator =
      valorFatura > 0.009 && Math.abs(somaItens - valorFatura) > 0.02
        ? valorFatura / somaItens
        : 1;
    return itens.map((item) => {
      const subtotal = Math.round(item.subtotal * fator * 100) / 100;
      const valorUn = Math.round(item.valorUn * fator * 100) / 100;
      return {
        tipo: "servico" as const,
        dataFatura: base.dataFatura,
        dataOrdem: base.dataOrdem,
        dataOrdemPeriodo: base.dataOrdemPeriodo,
        numFatura: base.numFatura,
        os: numeroOsExtrato(item.os),
        servico: descricaoServicoExtrato(item.descricao),
        qtd: item.qtd,
        paciente: item.paciente || "—",
        numDente: item.numDente && item.numDente !== "—" ? item.numDente : "",
        dataEntrega: item.dataEntrega,
        valorUn,
        desconto: descontoItem(item.qtd, valorUn, subtotal),
        subtotal,
      };
    });
  }

  if (valorFatura <= 0.009) return [];

  const pack = desempacotarDespesa(l.descricao);
  const osNums =
    relacionados.length > 0
      ? [...new Set(relacionados.map((t) => t.numeroOs).filter((n) => n > 0 && n < 1_000_000))]
      : numerosOsDoLancamentoFatura(l);
  return [
    {
      tipo: "servico",
      dataFatura: base.dataFatura,
      dataOrdem: base.dataOrdem,
      dataOrdemPeriodo: base.dataOrdemPeriodo,
      numFatura: base.numFatura,
      os: osNums.length ? osNums.map(numeroOsExtrato).filter(Boolean).join(", ") : "",
      servico: descricaoServicoExtrato(pack.texto.split("\n")[0]?.trim() || "Cobrança"),
      qtd: "1",
      paciente: "—",
      numDente: "",
      dataEntrega: "",
      valorUn: valorFatura,
      desconto: 0,
      subtotal: valorFatura,
    },
  ];
}

function pushPagamentoExtrato(
  linhas: LinhaExtratoIndividual[],
  l: LancamentoContasReceber,
  valor: number,
  periodoCampo: "data_lancamento" | "vencimento",
  servico?: string
) {
  if (valor <= 0.009) return;
  linhas.push({
    tipo: "pagamento",
    dataFatura: formatDate(l.data),
    dataOrdem: dateOnly(l.data),
    dataOrdemPeriodo: dataRefLancamento(l, periodoCampo),
    numFatura: "",
    os: "",
    servico: servico || textoPagamento(l),
    qtd: "",
    paciente: "",
    numDente: "",
    dataEntrega: "",
    valorUn: 0,
    desconto: 0,
    subtotal: -Math.abs(valor),
  });
}

function dataRefLancamento(
  l: LancamentoContasReceber,
  periodoCampo: "data_lancamento" | "vencimento"
) {
  if (periodoCampo === "data_lancamento") {
    return dataFaturaLancamento(l).ordem;
  }
  return dateOnly(l.data);
}

function dentroPeriodo(d: Date, inicio: Date | null | undefined, fim: Date | null | undefined) {
  if (inicio && d < inicio) return false;
  if (fim && d > fim) return false;
  return true;
}

function parseQtd(qtd: string) {
  return Number(qtd.replace(",", ".")) || 1;
}

function dataEntregaTrabalho(trabalho: TrabalhoRelatorioFatura) {
  if (trabalho.dataEntrega) return formatDate(trabalho.dataEntrega);
  if (trabalho.dataPrevista) return formatDate(trabalho.dataPrevista);
  return "";
}

function descontoItem(qtd: string, valorUn: number, subtotal: number) {
  return Math.max(0, parseQtd(qtd) * valorUn - subtotal);
}

/** Apenas número da OS registrada (sem prefixo "OS" / "OS #" e sem ids aleatórios). */
export function numeroOsExtrato(valor: string | number | null | undefined): string {
  if (valor == null || valor === "") return "";
  if (typeof valor === "number") {
    if (!Number.isInteger(valor) || valor <= 0 || valor >= 1_000_000) return "";
    return String(valor);
  }
  const texto = String(valor).trim();
  const limpo = texto.replace(/^OS\s*#?\s*/i, "").trim();
  const match = limpo.match(/^(\d{1,6})$/);
  return match ? match[1] : "";
}

/** Descrição do serviço sem "OS #" (a OS fica só na coluna OS). */
export function descricaoServicoExtrato(texto: string): string {
  let t = texto.trim();
  if (!t) return "—";

  t = t.replace(/^Cobran[cç]a\s+OS\s+[\d,\s]+\s*[-–:]\s*/i, "");
  t = t.replace(/^OS\s*#\s*\d+\s*[-–:]\s*/gi, "");
  t = t.replace(/^OS\s*#\s*\d+\s+/gi, "");
  t = t.replace(/\bOS\s*#\s*\d+\s*[-–:]\s*/gi, "");
  t = t.replace(/\bOS\s*#\s*\d+\b/gi, "");
  t = t.replace(/^\s*[-–:]\s*/, "");
  t = t.replace(/\s{2,}/g, " ").trim();
  return t || "—";
}

export function montarExtratoIndividual(
  lancamentos: LancamentoContasReceber[],
  trabalhos: TrabalhoRelatorioFatura[],
  nomeCliente: string,
  opcoes?: {
    saldoAnterior?: number;
    dataInicio?: Date | null;
    dataFinal?: Date | null;
    clienteId?: string | null;
    periodoCampo?: "data_lancamento" | "vencimento";
  }
): {
  linhas: LinhaExtratoIndividualComSaldo[];
  resumo: ResumoExtratoIndividual;
} {
  const periodoCampo = opcoes?.periodoCampo ?? "data_lancamento";
  const receitas = filtrarReceitasCliente(
    lancamentos,
    nomeCliente,
    opcoes?.clienteId
  );
  const trabalhosCliente = filtrarTrabalhosCliente(
    trabalhos,
    opcoes?.clienteId,
    nomeCliente
  );

  const numerosFatura = new Map<string, number>();
  for (const l of receitas) {
    numerosFatura.set(l.id, numeroFaturaDeLancamento(l, receitas));
  }

  const faturaPorGrupo = new Map<string, number>();
  for (const l of receitas) {
    if (!ehFaturaContasReceberExtrato(l)) continue;
    const chave = chaveAgrupamentoFatura(l);
    if (!faturaPorGrupo.has(chave)) {
      faturaPorGrupo.set(chave, numeroFaturaDeLancamento(l, receitas));
    }
  }

  const gruposItensProcessados = new Set<string>();
  const linhasBrutas: LinhaExtratoIndividual[] = [];
  const movimentosPagamentoVistos = new Set<string>();

  for (const l of receitas) {
    // Adiantamento / crédito gerado: aparece no extrato, mas não altera o saldo
    // (só o abatimento posterior reduz a dívida).
    if (isCreditoGerado(l)) {
      const valor = valorNumerico(l.valor);
      linhasBrutas.push({
        tipo: "credito",
        dataFatura: formatDate(l.data),
        dataOrdem: dateOnly(l.data),
        dataOrdemPeriodo: dataRefLancamento(l, periodoCampo),
        numFatura: "",
        os: "",
        servico: observacaoRecebimentoCurta(l.descricao),
        qtd: "",
        paciente: "",
        numDente: "",
        dataEntrega: "",
        valorUn: Math.abs(valor),
        desconto: 0,
        subtotal: 0,
      });
      continue;
    }

    // Parcial / abatimento: só via movimentos da fatura (abaixo), evita órfãos.
    if (isCreditoUtilizado(l) || isRecebimentoParcial(l)) {
      continue;
    }

    // Extrato só com Cobrança OS / Cobrança sem O.S. de Contas a Receber.
    if (!ehFaturaContasReceberExtrato(l)) {
      continue;
    }

    const chaveGrupo = chaveAgrupamentoFatura(l);
    if (!gruposItensProcessados.has(chaveGrupo)) {
      gruposItensProcessados.add(chaveGrupo);

      const { texto, ordem } = dataFaturaLancamento(l);
      const dataOrdemPeriodo = dataRefLancamento(l, periodoCampo);
      const numFat = String(
        faturaPorGrupo.get(chaveGrupo) ?? numerosFatura.get(l.id) ?? ""
      );
      const relacionados = trabalhosDaFaturaParaExtrato(l, trabalhosCliente, receitas);
      linhasBrutas.push(
        ...linhasServicoDaFaturaExtrato(l, relacionados, {
          dataFatura: texto,
          dataOrdem: ordem,
          dataOrdemPeriodo,
          numFatura: numFat,
        })
      );
    }
  }

  // Pagamentos/abatimentos alinhados ao histórico da fatura (sem duplicar órfãos).
  for (const fatura of receitas) {
    if (!ehFaturaContasReceberExtrato(fatura)) continue;
    for (const mov of movimentacoesRecebimentoDaFatura(fatura, receitas)) {
      if (movimentosPagamentoVistos.has(mov.id)) continue;
      movimentosPagamentoVistos.add(mov.id);

      if (isCreditoGerado(mov)) continue; // já listado como crédito (não altera saldo)

      if (isCreditoUtilizado(mov)) {
        // Abatimento de crédito conta como pagamento (não como desconto).
        pushPagamentoExtrato(
          linhasBrutas,
          mov,
          valorNumerico(mov.valor),
          periodoCampo,
          observacaoRecebimentoCurta(mov.descricao)
        );
        continue;
      }

      if (isRecebimentoParcial(mov)) {
        pushPagamentoExtrato(
          linhasBrutas,
          mov,
          valorNumerico(mov.valor),
          periodoCampo,
          observacaoRecebimentoCurta(mov.descricao)
        );
        continue;
      }

      if (mov.id === fatura.id && fatura.status === "pago") {
        const cash = valorRecebidoCashNaFaturaPaga(fatura, receitas);
        pushPagamentoExtrato(
          linhasBrutas,
          fatura,
          cash,
          periodoCampo,
          observacaoRecebimentoCurta(fatura.descricao)
        );
      }
    }
  }

  // Abatimentos órfãos (sem Cobrança OS correspondente) ainda entram como pagamento.
  for (const l of receitas) {
    if (!isCreditoUtilizado(l)) continue;
    if (movimentosPagamentoVistos.has(l.id)) continue;
    movimentosPagamentoVistos.add(l.id);
    pushPagamentoExtrato(
      linhasBrutas,
      l,
      valorNumerico(l.valor),
      periodoCampo,
      observacaoRecebimentoCurta(l.descricao)
    );
  }

  linhasBrutas.sort((a, b) => {
    const t = a.dataOrdem.getTime() - b.dataOrdem.getTime();
    if (t !== 0) return t;
    const ordemTipo: Record<TipoLinhaExtratoIndividual, number> = {
      saldo_anterior: 0,
      servico: 1,
      credito: 2,
      desconto: 3,
      pagamento: 4,
    };
    return ordemTipo[a.tipo] - ordemTipo[b.tipo];
  });

  const inicio = opcoes?.dataInicio ?? null;
  const fim = opcoes?.dataFinal ?? null;
  let saldoAnterior = opcoes?.saldoAnterior;
  if (saldoAnterior === undefined && inicio) {
    saldoAnterior = linhasBrutas
      .filter((l) => (l.dataOrdemPeriodo ?? l.dataOrdem) < inicio)
      .reduce((s, l) => s + l.subtotal, 0);
  }
  saldoAnterior = saldoAnterior ?? 0;
  const creditoAbertura = calcularCreditoDisponivelClienteFaturaAte(
    receitas,
    opcoes?.clienteId ?? undefined,
    inicio
  );

  const linhasPeriodo = linhasBrutas.filter((l) => {
    const ref = l.dataOrdemPeriodo ?? l.dataOrdem;
    if (!inicio && !fim) return true;
    return dentroPeriodo(ref, inicio, fim);
  });

  let saldo = saldoAnterior;
  const comSaldo: LinhaExtratoIndividualComSaldo[] = [
    {
      tipo: "saldo_anterior",
      dataFatura: "",
      dataOrdem: new Date(0),
      numFatura: "",
      os: "",
      servico: "Saldo Anterior",
      qtd: "",
      paciente: "",
      numDente: "",
      dataEntrega: "",
      valorUn: 0,
      desconto: 0,
      subtotal: 0,
      saldo: saldoAnterior,
    },
  ];

  let totalServicos = 0;
  let totalPagamentos = 0;
  let totalDescontos = 0;

  for (const linha of linhasPeriodo) {
    let subtotalEfetivo = linha.subtotal;
    // Abatimento de crédito só liquida cobrança em aberto — nunca gera saldo negativo (C).
    if (ehLinhaAbatimentoCredito(linha) && subtotalEfetivo < -0.009) {
      const maxAbater = Math.max(0, saldo);
      const abater = Math.min(Math.abs(subtotalEfetivo), maxAbater);
      subtotalEfetivo = -abater;
      if (abater <= 0.009) continue;
    }
    saldo += subtotalEfetivo;
    comSaldo.push({ ...linha, subtotal: subtotalEfetivo, saldo });
    if (linha.tipo === "servico" && subtotalEfetivo > 0) totalServicos += subtotalEfetivo;
    if (linha.tipo === "pagamento") totalPagamentos += Math.abs(subtotalEfetivo);
    if (linha.tipo === "desconto") totalDescontos += Math.abs(subtotalEfetivo);
  }

  return {
    linhas: comSaldo,
    resumo: {
      saldoAnterior,
      creditoAbertura,
      totalServicos,
      totalPagamentos,
      totalDescontos,
      saldoTotal: saldo,
    },
  };
}
