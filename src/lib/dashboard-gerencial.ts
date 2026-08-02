import {
  classificarCurvaAbcPorNome,
  criarIndiceTrabalhosCurvaAbc,
  gerarCurvaAbcClientes,
  gerarCurvaAbcClientesPorOs,
  type RecebimentoCurvaAbc,
  type SecaoCurvaAbc,
} from "@/lib/curva-abc-clientes";
import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import { calcularMatrizDre, type LancamentoDre } from "@/lib/dre";
import { valorEfetivoLancamentoFinanceiro } from "@/lib/lancamento-valor-caixa";
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
import {
  valorServicoTrabalhoFinanceiro,
  type TrabalhoFinanceiroGeralInput,
} from "@/lib/relatorio-financeiro-geral";
import type { TrabalhoProducaoSetorRef } from "@/lib/dashboard-producao-setores";
import {
  trabalhoContaNoGraficoProducao,
  type TrabalhoProducaoResumo,
} from "@/lib/dashboard-producao";
import { filtrarTrabalhosAtrasados } from "@/lib/controle-producao-prazos";
import { dateToBrShort } from "@/lib/datas-br";
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

function trabalhoParaValorFinanceiro(t: TrabalhoDashboardGerencial): TrabalhoFinanceiroGeralInput {
  const dataEntrada =
    typeof t.dataEntrada === "string" ? t.dataEntrada : t.dataEntrada.toISOString();
  const dataPrevista =
    t.dataPrevista == null
      ? null
      : typeof t.dataPrevista === "string"
        ? t.dataPrevista
        : t.dataPrevista.toISOString();
  const dataEntrega =
    t.dataEntrega == null
      ? null
      : typeof t.dataEntrega === "string"
        ? t.dataEntrega
        : t.dataEntrega.toISOString();

  return {
    id: t.id,
    numeroOs: t.numeroOs,
    tipoProtese: t.tipoProtese || "",
    valor: t.valor,
    status: t.status,
    segmentoFaturamento: t.segmentoFaturamento || "servico",
    dataEntrada,
    dataPrevista,
    dataEntrega,
    instrucoes: t.instrucoes ?? null,
    clienteNome: t.clienteNome,
    pacienteNome: "",
  };
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
  const base = trabalhos.filter(
    (t) => t.status !== "cancelado" && trabalhoContaNoGraficoProducao(t)
  );
  return filtrarTrabalhosAtrasados(base, "lab").length;
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
      const efetivo = valorEfetivoLancamentoFinanceiro(
        {
          id: l.id,
          tipo: l.tipo,
          descricao: l.descricao,
          valor: l.valor,
          status: l.status,
          formaPagamento: l.formaPagamento,
          cliente: l.clienteId ? { id: l.clienteId, nome: l.clienteNome || undefined } : null,
        },
        lancamentosFinanceiro.map((x) => ({
          id: x.id,
          tipo: x.tipo,
          descricao: x.descricao,
          valor: x.valor,
          status: x.status,
          formaPagamento: x.formaPagamento,
          cliente: x.clienteId
            ? { id: x.clienteId, nome: x.clienteNome || undefined }
            : null,
        }))
      );
      contasReceber[m].recebido += efetivo;
    } else {
      const saldo = saldoFaturaCobrancaOs(l, lancamentosFinanceiro);
      if (saldo > 0.005) contasReceber[m].aReceber += saldo;
    }
  }

  for (const l of lancamentos) {
    if (l.status === "cancelado") continue;
    if (anoData(l.data) !== ano) continue;
    const m = mesIndex(l.data);
    const efetivo = valorEfetivoLancamentoFinanceiro(l, lancamentos);
    if (efetivo <= 0.009) continue;
    if (isReceitaPaga(l)) {
      receitasDespesas[m].receitas += efetivo;
    } else if (isDespesaRealizada(l)) {
      receitasDespesas[m].despesas += efetivo;
    }
  }

  const itensServicoValor = trabalhosServico
    .map((t) => ({
      nome: nomeServicoExibicao(t.tipoProtese || ""),
      valor: valorServicoTrabalhoFinanceiro(trabalhoParaValorFinanceiro(t)),
    }))
    .filter((item) => item.valor > 0.009);

  // ABC Clientes: valor atual das OS do ano (editar/excluir OS atualiza a curva).
  // Complementa com recebimentos de caixa do ano (mesma regra do relatório ABC).
  const curvaPorOs = gerarCurvaAbcClientesPorOs(
    trabalhosAno.map((t) => ({
      clienteId: t.clienteId,
      clienteNome: t.clienteNome,
      valor: valorServicoTrabalhoFinanceiro(trabalhoParaValorFinanceiro(t)),
      status: t.status,
    }))
  );

  const indiceTrabalhos = criarIndiceTrabalhosCurvaAbc(
    trabalhos.map((t) => ({
      id: t.id,
      numeroOs: t.numeroOs,
      tipoProtese: t.tipoProtese || "",
      instrucoes: t.instrucoes,
      clienteId: t.clienteId,
      clienteNome: t.clienteNome,
    }))
  );

  const curvaPorRecebimentos = gerarCurvaAbcClientes(
    recebimentosCurva,
    indiceTrabalhos,
    {
      dataInicio: dateToBrShort(new Date(ano, 0, 1)),
      dataFim: dateToBrShort(new Date(ano, 11, 31)),
      repeticao: "",
      urgente: "",
    }
  );

  // Preferência: OS do ano (reflete edição/exclusão). Se não houver OS com valor, usa caixa.
  const curvaAbcClientesSecoes =
    curvaPorOs.total > 0.009 ? curvaPorOs.secoes : curvaPorRecebimentos.secoes;

  const secoesServicos = classificarCurvaAbcPorNome(itensServicoValor).secoes;
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
