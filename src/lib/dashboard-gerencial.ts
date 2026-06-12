import {
  classificarCurvaAbcPorNome,
  gerarCurvaAbcClientes,
  type RecebimentoCurvaAbc,
  type SecaoCurvaAbc,
} from "@/lib/curva-abc-clientes";
import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import { calcularMatrizDre, type LancamentoDre } from "@/lib/dre";
import {
  calcularResumoFinanceiroDashboard,
  contarClientesInadimplentes,
  ehCobrancaOsReceita,
  listarFaturasInadimplentes,
  saldoFaturaCobrancaOs,
  type FaturaInadimplente,
  type LancamentoFinanceiroResumo,
  type TrabalhoFinanceiroRef,
} from "@/lib/dashboard-financeiro";
import type { TrabalhoProducaoSetorRef } from "@/lib/dashboard-producao-setores";
import {
  trabalhoContaNoGraficoProducao,
  type TrabalhoProducaoResumo,
} from "@/lib/dashboard-producao";
export const MESES_DASHBOARD_GERENCIAL = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export type ItemCurvaAbcDashboard = {
  rotulo: string;
  valor: number;
  percentual: number;
  acumulado: number;
  classe?: "A" | "B" | "C";
};

export type SerieMensalDashboard = {
  mes: string;
  valor: number;
};

export type ContasReceberMensalDashboard = {
  mes: string;
  recebido: number;
  aReceber: number;
};

export type ReceitasDespesasMensalDashboard = {
  mes: string;
  receitas: number;
  despesas: number;
};

export type ResumoBarraDashboardGerencial = {
  inadimplentes: number;
  servicosAtrasados: number;
  contasAPagar: number;
  contasAReceber: number;
};

export type DashboardGerencialPayload = {
  ano: number;
  resumo: ResumoBarraDashboardGerencial;
  inadimplentes: FaturaInadimplente[];
  kpis: {
    receitaBruta: number;
    margemLucro: number;
    custoProducao: number;
  };
  curvaAbc: {
    servicos: ItemCurvaAbcDashboard[];
    fornecedores: ItemCurvaAbcDashboard[];
    clientes: ItemCurvaAbcDashboard[];
  };
  /** Detalhe por classe (A/B/C) para modais ao clicar nos gráficos. */
  curvaAbcServicosSecoes: SecaoCurvaAbc[];
  curvaAbcFornecedoresSecoes: SecaoCurvaAbc[];
  curvaAbcClientesSecoes: SecaoCurvaAbc[];
  producao: {
    entregues: number;
    atrasados: number;
    total: number;
  };
  /** Trabalhos do ano para gráficos de produção / setores / colaboradores (filtro de mês no cliente). */
  trabalhosProducao: TrabalhoProducaoSetorRef[];
  pedidos: SerieMensalDashboard[];
  contasReceber: ContasReceberMensalDashboard[];
  receitasDespesas: ReceitasDespesasMensalDashboard[];
};

export type TrabalhoDashboardGerencial = TrabalhoProducaoResumo & {
  id: string;
  numeroOs: number;
  valor: number;
  dataPrevista?: string | Date | null;
  dataEntrega?: string | Date | null;
  clienteId: string;
  clienteNome: string;
  instrucoes?: string | null;
};

function mesIndex(data: string | Date) {
  const d = new Date(data);
  return d.getMonth();
}

function anoData(data: string | Date) {
  const d = new Date(data);
  return d.getFullYear();
}

function despesaEhFornecedor(descricao: string) {
  const pack = desempacotarDespesa(descricao);
  if (pack.meta.entidade === "fornecedores") return true;
  return /^Orçamento #/i.test(pack.texto);
}

function agregarItensFornecedoresAno(lancamentos: LancamentoDre[], ano: number) {
  const itens: { nome: string; valor: number }[] = [];

  for (const l of lancamentos) {
    if (l.tipo !== "despesa") continue;
    if (l.status !== "pago") continue;
    if (anoData(l.data) !== ano) continue;
    if (!despesaEhFornecedor(l.descricao)) continue;

    const pack = desempacotarDespesa(l.descricao);
    const nome = pack.nome.trim();
    if (!nome || nome === "—") continue;

    itens.push({ nome, valor: Math.abs(l.valor) });
  }

  return itens;
}

function nomeServicoExibicao(tipoProtese: string) {
  const texto = (tipoProtese || "").trim();
  if (!texto) return "Sem serviço";
  return texto.replace(/^(produto|transporte|frete):\s*/i, "").trim() || texto;
}

const CLASSES_ABC: ("A" | "B" | "C")[] = ["A", "B", "C"];

/** Barras A/B/C — rótulo fixo (50/30/20) e comprimento 0–1 (participação no total). */
export function montarCurvaAbcSecoesGrafico(secoes: SecaoCurvaAbc[]): ItemCurvaAbcDashboard[] {
  const total = secoes.reduce((s, sec) => s + sec.subtotal, 0);

  return CLASSES_ABC.map((classe) => {
    const secao =
      secoes.find((s) => s.classe === classe) ??
      ({
        classe,
        metaPercentual: classe === "A" ? 50 : classe === "B" ? 30 : 20,
        linhas: [],
        subtotal: 0,
      } as SecaoCurvaAbc);

    const fracao = total > 0 ? secao.subtotal / total : 0;

    return {
      rotulo: `${secao.classe} - ${secao.metaPercentual}%`,
      valor: secao.subtotal,
      percentual: secao.linhas.reduce((s, linha) => s + linha.percentual, 0),
      acumulado: fracao,
      classe: secao.classe,
    };
  });
}

export function secoesCurvaAbcVazias(): SecaoCurvaAbc[] {
  return [
    { classe: "A", metaPercentual: 50, linhas: [], subtotal: 0 },
    { classe: "B", metaPercentual: 30, linhas: [], subtotal: 0 },
    { classe: "C", metaPercentual: 20, linhas: [], subtotal: 0 },
  ];
}

/** @deprecated Use secoesCurvaAbcVazias */
export const secoesCurvaAbcClientesVazias = secoesCurvaAbcVazias;

function serieMensalVazia(): SerieMensalDashboard[] {
  return MESES_DASHBOARD_GERENCIAL.map((mes) => ({ mes, valor: 0 }));
}

function contasReceberVazias(): ContasReceberMensalDashboard[] {
  return MESES_DASHBOARD_GERENCIAL.map((mes) => ({
    mes,
    recebido: 0,
    aReceber: 0,
  }));
}

function receitasDespesasVazias(): ReceitasDespesasMensalDashboard[] {
  return MESES_DASHBOARD_GERENCIAL.map((mes) => ({
    mes,
    receitas: 0,
    despesas: 0,
  }));
}

function isReceitaPaga(l: LancamentoDre) {
  return l.tipo === "receita" && l.status === "pago";
}

function isDespesaRealizada(l: LancamentoDre) {
  return l.tipo === "despesa" && l.status === "pago";
}

function contarServicosAtrasadosAtual(trabalhos: TrabalhoDashboardGerencial[]) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let total = 0;

  for (const t of trabalhos) {
    if (t.status === "cancelado") continue;
    if (!trabalhoContaNoGraficoProducao(t)) continue;
    if (["entregue", "finalizado", "saiu_entrega"].includes(t.status)) continue;
    const prevista = t.dataPrevista ? new Date(t.dataPrevista) : null;
    if (!prevista) continue;
    prevista.setHours(0, 0, 0, 0);
    if (prevista < hoje) total += 1;
  }

  return total;
}

export function calcularDashboardGerencial(input: {
  ano: number;
  lancamentos: LancamentoDre[];
  lancamentosFinanceiro: LancamentoFinanceiroResumo[];
  trabalhos: TrabalhoDashboardGerencial[];
  recebimentosCurva: RecebimentoCurvaAbc[];
}): DashboardGerencialPayload {
  const { ano, lancamentos, lancamentosFinanceiro, trabalhos, recebimentosCurva } =
    input;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const matriz = calcularMatrizDre(lancamentos, ano);
  const receitaBrutaAno =
    matriz.linhas.find((l) => l.id === "receita_bruta")?.total ?? 0;
  const lucroLiquidoAno =
    matriz.linhas.find((l) => l.id === "lucro_liquido")?.total ?? 0;
  const custosFixosAno =
    matriz.linhas.find((l) => l.id === "custos_fixos")?.total ?? 0;
  const custosVariaveisAno =
    matriz.linhas.find((l) => l.id === "custos_variaveis")?.total ?? 0;

  const margemLucro =
    receitaBrutaAno > 0 ? (lucroLiquidoAno / receitaBrutaAno) * 100 : 0;

  const trabalhosAno = trabalhos.filter((t) => {
    if (t.status === "cancelado") return false;
    return anoData(t.dataEntrada) === ano;
  });

  const trabalhosServico = trabalhosAno.filter(trabalhoContaNoGraficoProducao);

  let entregues = 0;
  let atrasados = 0;
  for (const t of trabalhosServico) {
    if (["entregue", "finalizado", "saiu_entrega"].includes(t.status)) {
      entregues += 1;
      continue;
    }
    const prevista = t.dataPrevista ? new Date(t.dataPrevista) : null;
    if (prevista) {
      prevista.setHours(0, 0, 0, 0);
      if (prevista < hoje) atrasados += 1;
    }
  }

  const pedidos = serieMensalVazia();
  const contasReceber = contasReceberVazias();
  const receitasDespesas = receitasDespesasVazias();

  for (const t of trabalhosServico) {
    const m = mesIndex(t.dataEntrada);
    pedidos[m].valor += 1;
  }

  for (const l of lancamentosFinanceiro) {
    if (!ehCobrancaOsReceita(l)) continue;
    if (anoData(l.data) !== ano) continue;
    const m = mesIndex(l.data);
    if (l.status === "pago") {
      contasReceber[m].recebido += Math.abs(l.valor);
    } else {
      const saldo = saldoFaturaCobrancaOs(l, lancamentosFinanceiro);
      if (saldo > 0.005) contasReceber[m].aReceber += saldo;
    }
  }

  for (const l of lancamentos) {
    if (l.status === "cancelado") continue;
    if (anoData(l.data) !== ano) continue;
    const m = mesIndex(l.data);
    if (isReceitaPaga(l)) {
      receitasDespesas[m].receitas += Math.abs(l.valor);
    } else if (isDespesaRealizada(l)) {
      receitasDespesas[m].despesas += Math.abs(l.valor);
    }
  }

  const itensServicoQtd = trabalhosServico.map((t) => ({
    nome: nomeServicoExibicao(t.tipoProtese || ""),
    valor: 1,
  }));

  const curvaClientes = gerarCurvaAbcClientes(recebimentosCurva, { porId: new Map(), porNumeroOs: new Map() }, {
    dataInicio: "",
    dataFim: "",
    repeticao: "",
    urgente: "",
  });

  const curvaAbcClientesSecoes = curvaClientes.secoes;

  const secoesServicos = classificarCurvaAbcPorNome(itensServicoQtd).secoes;
  const secoesFornecedores = classificarCurvaAbcPorNome(
    agregarItensFornecedoresAno(lancamentos, ano)
  ).secoes;

  const trabalhosRef: TrabalhoFinanceiroRef[] = trabalhos.map((t) => ({
    id: t.id,
    numeroOs: t.numeroOs,
    status: t.status,
  }));
  const financeiro = calcularResumoFinanceiroDashboard(
    lancamentosFinanceiro,
    trabalhosRef
  );
  const faturasInadimplentes = listarFaturasInadimplentes(
    lancamentosFinanceiro,
    trabalhosRef
  );

  return {
    ano,
    resumo: {
      inadimplentes: contarClientesInadimplentes(faturasInadimplentes),
      servicosAtrasados: contarServicosAtrasadosAtual(trabalhos),
      contasAPagar: financeiro.despesasAPagar,
      contasAReceber: financeiro.receitasAReceber,
    },
    inadimplentes: faturasInadimplentes,
    kpis: {
      receitaBruta: receitaBrutaAno,
      margemLucro,
      custoProducao: custosFixosAno + custosVariaveisAno,
    },
    curvaAbc: {
      servicos: montarCurvaAbcSecoesGrafico(secoesServicos),
      fornecedores: montarCurvaAbcSecoesGrafico(secoesFornecedores),
      clientes: montarCurvaAbcSecoesGrafico(curvaAbcClientesSecoes),
    },
    curvaAbcServicosSecoes: secoesServicos,
    curvaAbcFornecedoresSecoes: secoesFornecedores,
    curvaAbcClientesSecoes,
    producao: {
      entregues,
      atrasados,
      total: Math.max(entregues + atrasados, 0),
    },
    trabalhosProducao: trabalhosServico.map((t) => ({
      id: t.id,
      status: t.status,
      dataEntrada: t.dataEntrada,
      dataPrevista: t.dataPrevista ?? null,
      segmentoFaturamento: t.segmentoFaturamento,
      instrucoes: t.instrucoes,
      tipoProtese: t.tipoProtese,
    })),
    pedidos,
    contasReceber,
    receitasDespesas,
  };
}

export function formatarMoedaDashboard(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatarMoedaResumo(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatarPercentualDashboard(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}
