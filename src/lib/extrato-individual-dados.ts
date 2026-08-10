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

/** Apenas dígitos da OS (sem prefixo "OS" / "OS #"). */
export function numeroOsExtrato(valor: string | number | null | undefined): string {
  if (valor == null || valor === "") return "";
  const texto = String(valor).trim();
  const match = texto.match(/(\d+)/);
  return match ? match[1] : texto.replace(/^OS\s*#?\s*/i, "").trim();
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
      if (relacionados.length > 0) {
        for (const t of relacionados) {
          for (const item of itensDoTrabalho(t)) {
            linhasBrutas.push({
              tipo: "servico",
              dataFatura: texto,
              dataOrdem: ordem,
              dataOrdemPeriodo,
              numFatura: numFat,
              os: numeroOsExtrato(item.os),
              servico: descricaoServicoExtrato(item.descricao),
              qtd: item.qtd,
              paciente: item.paciente || "—",
              numDente: item.numDente && item.numDente !== "—" ? item.numDente : "",
              dataEntrega: dataEntregaTrabalho(t),
              valorUn: item.valorUn,
              desconto: descontoItem(item.qtd, item.valorUn, item.subtotal),
              subtotal: item.subtotal,
            });
          }
        }
      } else {
        // Nota existe sem OS resolvida: ainda assim mostra o valor faturado.
        const pack = desempacotarDespesa(l.descricao);
        const subtotal = valorNumerico(l.valor);
        const osNums = numerosOsDoLancamentoFatura(l);
        linhasBrutas.push({
          tipo: "servico",
          dataFatura: texto,
          dataOrdem: ordem,
          dataOrdemPeriodo,
          numFatura: numFat,
          os: osNums.length ? osNums.map(numeroOsExtrato).join(", ") : "",
          servico: descricaoServicoExtrato(pack.texto.split("\n")[0]?.trim() || "Cobrança"),
          qtd: "1",
          paciente: "—",
          numDente: "",
          dataEntrega: "",
          valorUn: subtotal,
          desconto: 0,
          subtotal,
        });
      }
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
    saldo += linha.subtotal;
    comSaldo.push({ ...linha, saldo });
    if (linha.tipo === "servico" && linha.subtotal > 0) totalServicos += linha.subtotal;
    if (linha.tipo === "pagamento") totalPagamentos += Math.abs(linha.subtotal);
    if (linha.tipo === "desconto") totalDescontos += Math.abs(linha.subtotal);
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
