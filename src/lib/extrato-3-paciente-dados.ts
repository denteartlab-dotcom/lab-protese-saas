import {
  chaveAgrupamentoFatura,
  filtrarTrabalhosCliente,
  itensDoTrabalho,
  nomePacienteTrabalho,
  trabalhosDaFaturaParaExtrato,
  type TrabalhoRelatorioFatura,
} from "@/lib/relatorio-faturas-modelo3-dados";
import {
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
import {
  descricaoServicoExtrato,
  numeroOsExtrato,
} from "@/lib/extrato-individual-dados";

export type TipoLinhaExtrato3 =
  | "saldo_anterior"
  | "pagamento"
  | "desconto"
  | "fatura"
  | "os"
  | "paciente"
  | "servico"
  | "subtotal";

export type LinhaExtrato3 = {
  tipo: TipoLinhaExtrato3;
  dataFatura: string;
  dataOrdem: Date;
  dataOrdemPeriodo?: Date;
  numFatura: string;
  os: string;
  qtd: string;
  servico: string;
  entrega: string;
  valorUn: number;
  descPercent: string;
  valor: number;
};

export type LinhaExtrato3ComSaldo = LinhaExtrato3 & { saldo: number };

export type ResumoExtrato3 = {
  saldoAnterior: number;
  creditoAbertura: number;
  totalServicos: number;
  totalPagamentos: number;
  totalDescontos: number;
  saldoTotal: number;
};

type ItemServico3 = {
  os: string;
  qtd: string;
  servico: string;
  entrega: string;
  valorUn: number;
  descPercent: string;
  valor: number;
};

type BlocoFatura3 = {
  dataOrdem: Date;
  dataOrdemPeriodo: Date;
  dataFatura: string;
  numFatura: string;
  pacientes: { nome: string; itens: ItemServico3[] }[];
};

type EventoExtrato3 =
  | { tipo: "movimento"; ordem: number; dataOrdem: Date; linha: LinhaExtrato3 }
  | { tipo: "bloco"; ordem: number; dataOrdem: Date; bloco: BlocoFatura3 };

function dateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
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

function ehCobrancaOs(l: LancamentoContasReceber) {
  const base = desempacotarDespesa(l.descricao).texto;
  return normalizarTexto(base).startsWith("cobranca os");
}

function dataFaturaLancamento(l: LancamentoContasReceber) {
  const d = l.createdAt ? new Date(l.createdAt) : new Date(l.data);
  return { texto: formatDate(d.toISOString()), ordem: dateOnly(d.toISOString()) };
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

function textoPagamentoExtrato3(l: LancamentoContasReceber) {
  const forma = (l.formaPagamento || "Externo").trim();
  if (forma.toLowerCase().includes("pix")) return "Pagamento Pix Externo";
  return `Pagamento ${forma}`;
}

function descCell(percent: string) {
  const p = percent.trim() || "0,00";
  return p.startsWith("%") ? p : `% ${p}`;
}

function dataEntregaTrabalho(trabalho: TrabalhoRelatorioFatura) {
  if (trabalho.dataEntrega) return formatDate(trabalho.dataEntrega);
  if (trabalho.dataPrevista) return formatDate(trabalho.dataPrevista);
  return "—";
}

function linhaVazia3(
  tipo: TipoLinhaExtrato3,
  partial: Partial<LinhaExtrato3> & Pick<LinhaExtrato3, "dataOrdem" | "valor">
): LinhaExtrato3 {
  return {
    tipo,
    dataFatura: "",
    numFatura: "",
    os: "",
    qtd: "",
    servico: "",
    entrega: "",
    valorUn: 0,
    descPercent: "",
    ...partial,
  };
}

/** Extrato 3 — agrupado por fatura e paciente (Smart Prótese). */
export function montarExtrato3Paciente(
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
): { linhas: LinhaExtrato3ComSaldo[]; resumo: ResumoExtrato3 } {
  const periodoCampo = opcoes?.periodoCampo ?? "data_lancamento";
  const receitas = filtrarReceitasCliente(lancamentos, nomeCliente, opcoes?.clienteId);
  const trabalhosCliente = filtrarTrabalhosCliente(
    trabalhos,
    opcoes?.clienteId,
    nomeCliente
  );

  const faturaPorGrupo = new Map<string, number>();
  for (const l of receitas) {
    if (!ehCobrancaOs(l)) continue;
    const chave = chaveAgrupamentoFatura(l);
    if (!faturaPorGrupo.has(chave)) {
      faturaPorGrupo.set(chave, numeroFaturaDeLancamento(l, receitas));
    }
  }

  const gruposProcessados = new Set<string>();
  const eventos: EventoExtrato3[] = [];
  let seq = 0;

  for (const l of receitas) {
    // Adiantamento, parcial e abatimento: só via movimentos da fatura (abaixo).
    if (isCreditoGerado(l) || isCreditoUtilizado(l) || isRecebimentoParcial(l)) {
      continue;
    }

    if (ehCobrancaOs(l) && trabalhosDaFaturaParaExtrato(l, trabalhosCliente, receitas).length === 0) {
      continue;
    }

    if (
      !ehCobrancaOs(l) &&
      l.trabalho?.id &&
      !trabalhosCliente.some((t) => t.id === l.trabalho?.id)
    ) {
      continue;
    }

    if (!ehCobrancaOs(l)) {
      if (l.status !== "pendente" && l.status !== "pago") continue;
      // Receita avulsa paga já entra como pagamento abaixo se for movimento de fatura;
      // aqui só monta bloco de serviço quando ainda é cobrança de serviço (não recebimento).
      if (l.status === "pago") continue;
      const { texto, ordem } = dataFaturaLancamento(l);
      const pack = desempacotarDespesa(l.descricao);
      const subtotal = valorNumerico(l.valor);
      const tRef = trabalhosCliente.find((t) => t.id === l.trabalho?.id);
      if (l.trabalho?.id && !tRef) continue;
      const paciente = tRef ? nomePacienteTrabalho(tRef) : "—";
      const bloco: BlocoFatura3 = {
        dataOrdem: ordem,
        dataOrdemPeriodo: dataRefLancamento(l, periodoCampo),
        dataFatura: texto,
        numFatura: String(numeroFaturaDeLancamento(l, receitas)),
        pacientes: [
          {
            nome: paciente,
            itens: [
              {
                os: l.trabalho?.numeroOs
                  ? numeroOsExtrato(l.trabalho.numeroOs)
                  : numeroOsExtrato(pack.texto),
                qtd: "1",
                servico: descricaoServicoExtrato(
                  pack.texto.split("\n")[0]?.trim() || "Receita"
                ),
                entrega: "—",
                valorUn: subtotal,
                descPercent: "0,00",
                valor: subtotal,
              },
            ],
          },
        ],
      };
      eventos.push({ tipo: "bloco", ordem: seq++, dataOrdem: ordem, bloco });
      continue;
    }

    const chaveGrupo = chaveAgrupamentoFatura(l);
    if (gruposProcessados.has(chaveGrupo)) continue;
    gruposProcessados.add(chaveGrupo);

    const { texto, ordem } = dataFaturaLancamento(l);
    const numFat = String(faturaPorGrupo.get(chaveGrupo) ?? "");
    const relacionados = trabalhosDaFaturaParaExtrato(l, trabalhosCliente, receitas);
    if (relacionados.length === 0) continue;

    const porPaciente = new Map<string, ItemServico3[]>();

    for (const t of relacionados) {
      const entregue = dataEntregaTrabalho(t);
      const nomePacTrabalho = nomePacienteTrabalho(t);
      for (const item of itensDoTrabalho(t)) {
        const pac =
          item.paciente?.trim() && item.paciente !== "—"
            ? item.paciente.trim()
            : nomePacTrabalho;
        const lista = porPaciente.get(pac) ?? [];
        lista.push({
          os: numeroOsExtrato(item.os),
          qtd: item.qtd,
          servico: descricaoServicoExtrato(item.descricao),
          entrega: entregue,
          valorUn: item.valorUn,
          descPercent: item.descPercent || "0,00",
          valor: item.subtotal,
        });
        porPaciente.set(pac, lista);
      }
    }

    const pacientes = Array.from(porPaciente.entries())
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([nome, itens]) => ({ nome, itens }));

    eventos.push({
      tipo: "bloco",
      ordem: seq++,
      dataOrdem: ordem,
      bloco: {
        dataOrdem: ordem,
        dataOrdemPeriodo: dataRefLancamento(l, periodoCampo),
        dataFatura: texto,
        numFatura: numFat,
        pacientes,
      },
    });
  }

  // Pagamentos/abatimentos alinhados ao Contas a Receber (mesma base dos modelos 1 e 2).
  const movimentosPagamentoVistos = new Set<string>();
  for (const fatura of receitas) {
    if (!ehCobrancaOs(fatura)) continue;
    for (const mov of movimentacoesRecebimentoDaFatura(fatura, receitas)) {
      if (movimentosPagamentoVistos.has(mov.id)) continue;
      movimentosPagamentoVistos.add(mov.id);

      if (isCreditoGerado(mov)) continue;

      if (isCreditoUtilizado(mov) || isRecebimentoParcial(mov)) {
        const valor = valorNumerico(mov.valor);
        if (valor <= 0.009) continue;
        const ordem = dateOnly(mov.data);
        eventos.push({
          tipo: "movimento",
          ordem: seq++,
          dataOrdem: ordem,
          linha: linhaVazia3("pagamento", {
            dataFatura: formatDate(mov.data),
            dataOrdem: ordem,
            dataOrdemPeriodo: dataRefLancamento(mov, periodoCampo),
            servico: observacaoRecebimentoCurta(mov.descricao),
            valor: -Math.abs(valor),
          }),
        });
        continue;
      }

      if (mov.id === fatura.id && fatura.status === "pago") {
        const cash = valorRecebidoCashNaFaturaPaga(fatura, receitas);
        if (cash <= 0.009) continue;
        const ordem = dateOnly(fatura.data);
        eventos.push({
          tipo: "movimento",
          ordem: seq++,
          dataOrdem: ordem,
          linha: linhaVazia3("pagamento", {
            dataFatura: formatDate(fatura.data),
            dataOrdem: ordem,
            dataOrdemPeriodo: dataRefLancamento(fatura, periodoCampo),
            servico: textoPagamentoExtrato3(fatura),
            valor: -Math.abs(cash),
          }),
        });
      }
    }
  }

  eventos.sort((a, b) => {
    const t = a.dataOrdem.getTime() - b.dataOrdem.getTime();
    if (t !== 0) return t;
    const prio = (e: EventoExtrato3) => {
      if (e.tipo === "bloco") return 1;
      if (e.tipo === "movimento") {
        if (e.linha.tipo === "pagamento") return 2;
        if (e.linha.tipo === "desconto") return 3;
      }
      return 4;
    };
    return prio(a) - prio(b) || a.ordem - b.ordem;
  });

  const linhasBrutas: LinhaExtrato3[] = [];
  for (const ev of eventos) {
    if (ev.tipo === "movimento") {
      linhasBrutas.push(ev.linha);
      continue;
    }
    const { bloco } = ev;
    let primeiraPacienteNoBloco = true;
    for (const { nome, itens } of bloco.pacientes) {
      const primeiro = itens[0];
      linhasBrutas.push(
        linhaVazia3("fatura", {
          dataFatura: primeiraPacienteNoBloco ? bloco.dataFatura : "",
          dataOrdem: bloco.dataOrdem,
          dataOrdemPeriodo: bloco.dataOrdemPeriodo,
          numFatura: primeiraPacienteNoBloco ? bloco.numFatura : "",
          os: primeiro?.os ?? "",
          qtd: primeiro?.qtd ?? "",
          valor: 0,
        })
      );
      primeiraPacienteNoBloco = false;
      linhasBrutas.push(
        linhaVazia3("paciente", {
          dataOrdem: bloco.dataOrdem,
          dataOrdemPeriodo: bloco.dataOrdemPeriodo,
          servico: `Paciente: ${nome}`,
          valor: 0,
        })
      );
      let sub = 0;
      for (let i = 0; i < itens.length; i++) {
        const item = itens[i];
        sub += item.valor;
        linhasBrutas.push(
          linhaVazia3("servico", {
            dataOrdem: bloco.dataOrdem,
            dataOrdemPeriodo: bloco.dataOrdemPeriodo,
            os: i === 0 ? "" : item.os,
            qtd: i === 0 ? "" : item.qtd,
            servico: item.servico,
            entrega: item.entrega,
            valorUn: item.valorUn,
            descPercent: descCell(item.descPercent),
            valor: item.valor,
          })
        );
      }
      linhasBrutas.push(
        linhaVazia3("subtotal", {
          dataOrdem: bloco.dataOrdem,
          dataOrdemPeriodo: bloco.dataOrdemPeriodo,
          servico: "Subtotal",
          valor: sub,
        })
      );
    }
  }

  const inicio = opcoes?.dataInicio ?? null;
  const fim = opcoes?.dataFinal ?? null;
  let saldoAnterior = opcoes?.saldoAnterior;
  if (saldoAnterior === undefined && inicio) {
    saldoAnterior = linhasBrutas
      .filter((l) => (l.dataOrdemPeriodo ?? l.dataOrdem) < inicio)
      .reduce((s, l) => {
        if (
          l.tipo === "servico" ||
          l.tipo === "fatura" ||
          l.tipo === "paciente" ||
          l.tipo === "os"
        ) {
          return s;
        }
        return s + l.valor;
      }, 0);
  }
  saldoAnterior = saldoAnterior ?? 0;
  const creditoAbertura = calcularCreditoDisponivelClienteFaturaAte(
    receitas,
    opcoes?.clienteId ?? undefined,
    inicio
  );

  const linhasPeriodo = linhasBrutas.filter((l) => {
    if (l.tipo === "fatura" || l.tipo === "paciente" || l.tipo === "os") {
      const ref = l.dataOrdemPeriodo ?? l.dataOrdem;
      if (!inicio && !fim) return true;
      return dentroPeriodo(ref, inicio, fim);
    }
    const ref = l.dataOrdemPeriodo ?? l.dataOrdem;
    if (!inicio && !fim) return true;
    return dentroPeriodo(ref, inicio, fim);
  });

  const linhasFiltradas = linhasPeriodo;

  let saldo = saldoAnterior;
  const comSaldo: LinhaExtrato3ComSaldo[] = [
    {
      tipo: "saldo_anterior",
      dataFatura: "",
      dataOrdem: new Date(0),
      numFatura: "",
      os: "",
      qtd: "",
      servico: "Saldo Anterior",
      entrega: "",
      valorUn: 0,
      descPercent: "",
      valor: 0,
      saldo: saldoAnterior,
    },
  ];

  let totalServicos = 0;
  let totalPagamentos = 0;
  let totalDescontos = 0;

  for (const linha of linhasFiltradas) {
    let saldoLinha = saldo;
    if (linha.tipo === "pagamento" || linha.tipo === "desconto") {
      saldo += linha.valor;
      saldoLinha = saldo;
      if (linha.tipo === "pagamento") totalPagamentos += Math.abs(linha.valor);
      else totalDescontos += Math.abs(linha.valor);
    } else if (linha.tipo === "subtotal") {
      saldo += linha.valor;
      saldoLinha = saldo;
      totalServicos += linha.valor;
    }
    comSaldo.push({ ...linha, saldo: saldoLinha });
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
