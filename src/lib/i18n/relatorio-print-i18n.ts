import type { DreCategoriaRelatorioId } from "@/lib/dre-relatorio-detalhado";
import type { MovimentoEstoque } from "@/lib/estoque";
import { translate, type Locale } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";
import { localeImpressaoAtual } from "@/lib/i18n/print-i18n";
import { pl } from "@/lib/i18n/print-relatorio-helpers";
import { nomeMesLocale } from "@/lib/i18n/relatorio-comum-i18n";
import { labelLinhaDrePorTexto } from "@/lib/i18n/relatorio-dre-i18n";
import {
  traduzirContaFluxo,
  traduzirDescricaoFluxo,
  traduzirFormaPagamentoFluxo,
} from "@/lib/i18n/relatorio-fluxo-i18n";
import { trUi, type TradutorUi } from "@/lib/i18n/tr-ui";
import type {
  PrioridadeTempoProducao,
  StatusTempoProducao,
} from "@/lib/tempo-producao-relatorio";

const CHAVES_CATEGORIA_DRE: Record<DreCategoriaRelatorioId, MessageKey> = {
  receita_bruta: "relatorio.dre.categoria.receita_bruta",
  impostos: "relatorio.dre.categoria.impostos",
  custos_fixos: "relatorio.dre.categoria.custos_fixos",
  custos_variaveis: "relatorio.dre.categoria.custos_variaveis",
  despesas: "relatorio.dre.categoria.despesas",
  despesas_nao_operacionais: "relatorio.dre.categoria.despesas_nao_operacionais",
  irpj_csll: "relatorio.dre.categoria.irpj_csll",
};

const CHAVES_TOTAL_DRE: Record<DreCategoriaRelatorioId, MessageKey> = {
  receita_bruta: "relatorio.dre.total.receita_bruta",
  impostos: "relatorio.dre.total.impostos",
  custos_fixos: "relatorio.dre.total.custos_fixos",
  custos_variaveis: "relatorio.dre.total.custos_variaveis",
  despesas: "relatorio.dre.total.despesas",
  despesas_nao_operacionais: "relatorio.dre.total.despesas_nao_operacionais",
  irpj_csll: "relatorio.dre.total.irpj_csll",
};

const CHAVES_STATUS_TEMPO: Record<StatusTempoProducao, MessageKey> = {
  em_dia: "relatorio.tempo.status.emDia",
  atencao: "relatorio.tempo.status.atencao",
  atrasado: "relatorio.tempo.status.atrasado",
  critico: "relatorio.tempo.status.critico",
};

const CHAVES_PRIORIDADE_TEMPO: Record<PrioridadeTempoProducao, MessageKey> = {
  urgente: "relatorio.tempo.prioridade.urgente",
  alta: "relatorio.tempo.prioridade.alta",
  normal: "relatorio.tempo.prioridade.normal",
  baixa: "relatorio.tempo.prioridade.baixa",
};

export function tradutorImpressao(locale?: Locale): TradutorUi {
  const loc = locale ?? localeImpressaoAtual();
  return (key, params) => translate(loc, key, params);
}

export function trImpressao(texto: string, locale?: Locale): string {
  const loc = locale ?? localeImpressaoAtual();
  return trUi(texto, tradutorImpressao(loc), loc);
}

export function tituloDrePdf(mesIndex: number, ano: number): string {
  const t = tradutorImpressao();
  return t("relatorio.dre.tituloDemonstrativo", { mes: mesIndex + 1, ano });
}

export function labelLinhaDrePdf(labelPt: string): string {
  return labelLinhaDrePorTexto(tradutorImpressao(), labelPt);
}

export function labelGrupoDreDetalhadoPdf(titulo: string): string {
  return trImpressao(titulo);
}

export function labelCategoriaDreDetalhadoPdf(
  id: DreCategoriaRelatorioId,
  fallback: string
): string {
  const t = tradutorImpressao();
  const chave = CHAVES_CATEGORIA_DRE[id];
  const traduzido = t(chave);
  return traduzido !== chave ? traduzido : trImpressao(fallback);
}

export function labelTotalDreDetalhadoPdf(
  id: DreCategoriaRelatorioId,
  fallback: string
): string {
  const t = tradutorImpressao();
  const chave = CHAVES_TOTAL_DRE[id];
  const traduzido = t(chave);
  return traduzido !== chave ? traduzido : trImpressao(fallback);
}

export function traduzirDescricaoPdf(descricao: string): string {
  return traduzirDescricaoFluxo(tradutorImpressao(), descricao);
}

export function traduzirFormaPagamentoPdf(forma: string): string {
  return traduzirFormaPagamentoFluxo(tradutorImpressao(), forma);
}

export function traduzirContaPdf(conta: string): string {
  return traduzirContaFluxo(tradutorImpressao(), conta);
}

export function traduzirSituacaoPdf(situacao: string): string {
  return trImpressao(situacao);
}

export function traduzirTipoMovimentoEstoquePdf(tipo: MovimentoEstoque["tipo"]): string {
  const t = tradutorImpressao();
  return tipo === "entrada"
    ? t("relatorio.estoque.tipo.entrada")
    : t("relatorio.estoque.tipo.saida");
}

export function labelStatusTempoProducaoPdf(status: StatusTempoProducao): string {
  return tradutorImpressao()(CHAVES_STATUS_TEMPO[status]);
}

export function labelPrioridadeTempoProducaoPdf(
  prioridade: PrioridadeTempoProducao
): string {
  return tradutorImpressao()(CHAVES_PRIORIDADE_TEMPO[prioridade]);
}

export function diasAbrevPdf(dias: number): string {
  return tradutorImpressao()("relatorio.comum.diasAbrev", { n: dias });
}

export function diasAtrasoPdf(dias: number): string {
  return tradutorImpressao()("relatorio.snc.diasAtraso", { n: dias });
}

export function periodoPdf(inicio: string, fim: string): string {
  return pl("print.relatorio.periodoIntervalo", { inicio, fim });
}

export function periodoPdfDeAte(inicio: string, fim: string): string {
  return tradutorImpressao()("relatorio.comum.periodoDeAte", { inicio, fim });
}

export function periodoNaoInformadoPdf(): string {
  return tradutorImpressao()("relatorio.comum.periodoNaoInformado");
}

export function labelMesFinanceiroPdf(mesIndex: number, ano: number): string {
  const locale = localeImpressaoAtual();
  return `${nomeMesLocale(locale, mesIndex)}/${ano}`;
}

export function labelSemEntregadorPdf(): string {
  return tradutorImpressao()("relatorio.entregas.semEntregador");
}
