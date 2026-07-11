import {
  ehDescricaoReceitaOs,
  numerosOsDoLancamentoFatura,
} from "@/lib/os-faturamento";
import {
  chaveAgrupamentoFatura,
  filtrarTrabalhosCliente,
  itensDoTrabalho,
  trabalhosDaFaturaParaExtrato,
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

export type TipoLinhaExtratoIndividual = "saldo_anterior" | "servico" | "pagamento" | "desconto";

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
  const forma = (l.formaPagamento || "Externo").trim();
  if (forma.toLowerCase().includes("pix")) return "Pagamento (Pix Externo)";
  return `Pagamento (${forma})`;
}

function ehReceitaOs(l: LancamentoContasReceber) {
  return ehDescricaoReceitaOs(descricaoBaseReceita(l));
}

function lancamentoSemTrabalhosValidos(
  l: LancamentoContasReceber,
  trabalhosCliente: TrabalhoRelatorioFatura[],
  receitas: LancamentoContasReceber[]
) {
  if (ehReceitaOs(l)) {
    return trabalhosDaFaturaParaExtrato(l, trabalhosCliente, receitas).length === 0;
  }
  if (l.trabalho?.id) {
    return !trabalhosCliente.some((t) => t.id === l.trabalho?.id);
  }
  const numerosOs = numerosOsDoLancamentoFatura(l);
  if (numerosOs.length === 0) return false;
  return !numerosOs.some((numero) =>
    trabalhosCliente.some((t) => t.numeroOs === numero)
  );
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
    if (!ehReceitaOs(l)) continue;
    const chave = chaveAgrupamentoFatura(l);
    if (!faturaPorGrupo.has(chave)) {
      faturaPorGrupo.set(chave, numeroFaturaDeLancamento(l, receitas));
    }
  }

  const gruposItensProcessados = new Set<string>();
  const linhasBrutas: LinhaExtratoIndividual[] = [];

  for (const l of receitas) {
    if (isCreditoGerado(l)) continue;

    if (lancamentoSemTrabalhosValidos(l, trabalhosCliente, receitas)) {
      continue;
    }

    if (isCreditoUtilizado(l)) {
      const { texto, ordem } = dataFaturaLancamento(l);
      const valor = valorNumerico(l.valor);
      linhasBrutas.push({
        tipo: "desconto",
        dataFatura: texto,
        dataOrdem: ordem,
        dataOrdemPeriodo: dataRefLancamento(l, periodoCampo),
        numFatura: "",
        os: "",
        servico: "Desconto com crédito",
        qtd: "",
        paciente: "",
        numDente: "",
        dataEntrega: "",
        valorUn: 0,
        desconto: 0,
        subtotal: -Math.abs(valor),
      });
      continue;
    }

    if (l.status === "pago") {
      const valor = valorNumerico(l.valor);
      const { texto, ordem } = dataFaturaLancamento(l);
      linhasBrutas.push({
        tipo: "pagamento",
        dataFatura: formatDate(l.data),
        dataOrdem: dateOnly(l.data),
        dataOrdemPeriodo: dataRefLancamento(l, periodoCampo),
        numFatura: "",
        os: "",
        servico: textoPagamento(l),
        qtd: "",
        paciente: "",
        numDente: "",
        dataEntrega: "",
        valorUn: 0,
        desconto: 0,
        subtotal: -Math.abs(valor),
      });
    }

    if (!ehReceitaOs(l)) {
      if (l.status !== "pendente" && l.status !== "pago") continue;
      const { texto, ordem } = dataFaturaLancamento(l);
      const pack = desempacotarDespesa(l.descricao);
      const subtotal = valorNumerico(l.valor);
      const osNum = l.trabalho?.numeroOs
        ? numeroOsExtrato(l.trabalho.numeroOs)
        : numeroOsExtrato(pack.texto);
      linhasBrutas.push({
        tipo: "servico",
        dataFatura: texto,
        dataOrdem: ordem,
        dataOrdemPeriodo: dataRefLancamento(l, periodoCampo),
        numFatura: String(numerosFatura.get(l.id) ?? ""),
        os: osNum,
        servico: descricaoServicoExtrato(pack.texto.split("\n")[0]?.trim() || "Receita"),
        qtd: "1",
        paciente: "—",
        numDente: "",
        dataEntrega: "",
        valorUn: subtotal,
        desconto: 0,
        subtotal,
      });
      continue;
    }

    const chaveGrupo = chaveAgrupamentoFatura(l);
    if (gruposItensProcessados.has(chaveGrupo)) continue;
    gruposItensProcessados.add(chaveGrupo);

    const { texto, ordem } = dataFaturaLancamento(l);
    const dataOrdemPeriodo = dataRefLancamento(l, periodoCampo);
    const numFat = String(
      faturaPorGrupo.get(chaveGrupo) ?? numerosFatura.get(l.id) ?? ""
    );
    const relacionados = trabalhosDaFaturaParaExtrato(l, trabalhosCliente, receitas);
    if (relacionados.length === 0) continue;

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
  }

  linhasBrutas.sort((a, b) => {
    const t = a.dataOrdem.getTime() - b.dataOrdem.getTime();
    if (t !== 0) return t;
    const ordemTipo = { saldo_anterior: 0, servico: 1, pagamento: 2, desconto: 3 };
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
      totalServicos,
      totalPagamentos,
      totalDescontos,
      saldoTotal: saldo,
    },
  };
}
