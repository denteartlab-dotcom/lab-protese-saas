import {
  chaveAgrupamentoFatura,
  itensDoTrabalho,
  nomePacienteTrabalho,
  trabalhosDaFatura,
  type TrabalhoRelatorioFatura,
} from "@/lib/relatorio-faturas-modelo3-dados";
import {
  isCreditoGerado,
  isCreditoUtilizado,
  numeroFaturaDeLancamento,
  type LancamentoContasReceber,
} from "@/lib/contas-receber-financeiro";
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

function descricaoBaseLancamento(l: LancamentoContasReceber) {
  return desempacotarDespesa(l.descricao).texto.split("\n")[0]?.trim() || "Cobrança OS";
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
    if (isCreditoGerado(l)) continue;

    if (isCreditoUtilizado(l)) {
      const { texto, ordem } = dataFaturaLancamento(l);
      const valor = valorNumerico(l.valor);
      eventos.push({
        tipo: "movimento",
        ordem: seq++,
        dataOrdem: ordem,
        linha: linhaVazia3("desconto", {
          dataFatura: texto,
          dataOrdem: ordem,
          dataOrdemPeriodo: dataRefLancamento(l, periodoCampo),
          servico: "Desconto com crédito",
          valor: -Math.abs(valor),
        }),
      });
      continue;
    }

    if (l.status === "pago" && !ehCobrancaOs(l)) {
      const valor = valorNumerico(l.valor);
      const ordem = dateOnly(l.data);
      eventos.push({
        tipo: "movimento",
        ordem: seq++,
        dataOrdem: ordem,
        linha: linhaVazia3("pagamento", {
          dataFatura: formatDate(l.data),
          dataOrdem: ordem,
          dataOrdemPeriodo: dataRefLancamento(l, periodoCampo),
          servico: textoPagamentoExtrato3(l),
          valor: -Math.abs(valor),
        }),
      });
    }

    if (!ehCobrancaOs(l)) {
      if (l.status !== "pendente" && l.status !== "pago") continue;
      const { texto, ordem } = dataFaturaLancamento(l);
      const pack = desempacotarDespesa(l.descricao);
      const subtotal = valorNumerico(l.valor);
      const tRef = trabalhos.find((t) => t.id === l.trabalho?.id);
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
    const relacionados = trabalhosDaFatura(l, trabalhos);
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

    if (porPaciente.size === 0) {
      const subtotal = valorNumerico(l.valor);
      let nomePac = "—";
      if (relacionados.length > 0) {
        nomePac = nomePacienteTrabalho(relacionados[0]);
      } else if (l.trabalho?.id) {
        const t = trabalhos.find((x) => x.id === l.trabalho?.id);
        if (t) nomePac = nomePacienteTrabalho(t);
      }
      porPaciente.set(nomePac, [
        {
          os: l.trabalho?.numeroOs ? numeroOsExtrato(l.trabalho.numeroOs) : "",
          qtd: "1",
          servico: descricaoServicoExtrato(descricaoBaseLancamento(l)),
          entrega: "—",
          valorUn: subtotal,
          descPercent: "0,00",
          valor: subtotal,
        },
      ]);
    }

    const pacientes = Array.from(porPaciente.entries())
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([nome, itens]) => ({ nome, itens }));

    if (l.status === "pago") {
      const valor = valorNumerico(l.valor);
      const ordemPag = dateOnly(l.data);
      eventos.push({
        tipo: "movimento",
        ordem: seq++,
        dataOrdem: ordemPag,
        linha: linhaVazia3("pagamento", {
          dataFatura: formatDate(l.data),
          dataOrdem: ordemPag,
          dataOrdemPeriodo: dataRefLancamento(l, periodoCampo),
          servico: textoPagamentoExtrato3(l),
          valor: -Math.abs(valor),
        }),
      });
    }

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
      totalServicos,
      totalPagamentos,
      totalDescontos,
      saldoTotal: saldo,
    },
  };
}
