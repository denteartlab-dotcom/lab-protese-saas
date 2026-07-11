import { carregarConfigLaboratorio } from "@/lib/configuracoes-lab";
import type { Locale } from "@/lib/i18n";
import {
  definirLocaleImpressao,
  formatMoneyImpressao,
  pl,
  resolverLocaleImpressao,
} from "@/lib/i18n/print-i18n";

export { pl };

/** Inicializa locale de impressão (config do lab ou parâmetro). */
export function iniciarImpressaoRelatorio(opts?: { locale?: Locale }) {
  const cfg = carregarConfigLaboratorio();
  definirLocaleImpressao(
    resolverLocaleImpressao({ locale: opts?.locale, configLab: cfg })
  );
}

/** Valor numérico formatado sem símbolo de moeda (tabelas). */
export function moneyRelatorio(valor: number) {
  return formatMoneyImpressao(valor, undefined, false);
}

/** Valor com símbolo de moeda. */
export function moneyRelatorioSimbolo(valor: number) {
  return formatMoneyImpressao(valor);
}

export function tituloPeriodoCampo(
  campo: "data_lancamento" | "vencimento" | "data_entrega" | "data_pagamento"
) {
  if (campo === "vencimento") return pl("print.relatorio.dataVencimento");
  if (campo === "data_entrega") return pl("print.relatorio.dataEntrega");
  if (campo === "data_pagamento") return pl("print.relatorio.dataPagamento");
  return pl("print.relatorio.dataLancamento");
}

export function periodoRelatorioTexto(inicio: string, fim: string) {
  return pl("print.relatorio.periodoIntervalo", { inicio, fim });
}

export function tituloRelatorioFaturas(
  campo: "data_lancamento" | "vencimento"
) {
  return pl("print.relatorio.tituloFaturas", {
    periodo: tituloPeriodoCampo(campo),
  });
}

export function tituloRelatorioDespesas(
  campo: "data_lancamento" | "vencimento"
) {
  return pl("print.relatorio.tituloDespesas", {
    periodo: tituloPeriodoCampo(campo),
  });
}

export function tituloRelatorioParcelasAReceber(
  campo: "data_lancamento" | "vencimento"
) {
  return pl("print.relatorio.tituloParcelasAReceber", {
    periodo: tituloPeriodoCampo(campo),
  });
}

export function tituloRelatorioParcelasAPagar(
  campo: "data_lancamento" | "vencimento"
) {
  return pl("print.relatorio.tituloParcelasAPagar", {
    periodo: tituloPeriodoCampo(campo),
  });
}

export function tituloExtratoFinanceiro(cliente: string) {
  return pl("print.extrato.tituloFinanceiro", { cliente });
}

export function obsFaturasSemAdiantamento(comPontoFinal = false) {
  return comPontoFinal
    ? pl("print.relatorio.obsFaturasSemAdiantamentoPonto")
    : pl("print.relatorio.obsFaturasSemAdiantamento");
}
