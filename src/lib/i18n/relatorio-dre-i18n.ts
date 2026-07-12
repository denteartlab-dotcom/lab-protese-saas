import type { MessageKey } from "@/lib/i18n";
import type { DreLinhaId } from "@/lib/dre";
import { trUi, type TradutorUi } from "@/lib/i18n/tr-ui";

const CHAVES_LINHA_DRE: Record<DreLinhaId, MessageKey> = {
  receita_bruta: "relatorio.dre.receitaOperacionalBruta",
  impostos: "relatorio.dre.linha.impostos",
  receita_liquida: "relatorio.dre.linha.receitaOperacionalLiquida",
  custos_fixos: "relatorio.dre.linha.custosFixos",
  custos_variaveis: "relatorio.dre.linha.custosVariaveis",
  despesas: "relatorio.dre.linha.despesas",
  resultado_operacional: "relatorio.dre.linha.resultadoOperacional",
  despesas_nao_operacionais: "relatorio.dre.linha.despesasNaoOperacionais",
  lair: "relatorio.dre.linha.lair",
  irpj_csll: "relatorio.dre.linha.irpjCsll",
  lucro_liquido: "relatorio.dre.lucroLiquido",
};

export function labelLinhaDre(t: TradutorUi, linhaId: DreLinhaId, labelPt?: string) {
  return t(CHAVES_LINHA_DRE[linhaId]);
}

export function labelLinhaDrePorTexto(t: TradutorUi, labelPt: string) {
  return trUi(labelPt, t);
}
