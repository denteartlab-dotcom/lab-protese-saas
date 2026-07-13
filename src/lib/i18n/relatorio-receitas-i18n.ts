import type { MessageKey } from "@/lib/i18n";
import type { ModeloRelatorioReceitas } from "@/lib/relatorio-receitas-modelos";
import type { TradutorUi } from "@/lib/i18n/tr-ui";

const CHAVES_MODELO: Record<ModeloRelatorioReceitas, MessageKey> = {
  "faturas-modelo-1": "financeiro.receber.relatorio.modelo.faturas1",
  "faturas-modelo-2": "financeiro.receber.relatorio.modelo.faturas2",
  "faturas-modelo-3": "financeiro.receber.relatorio.modelo.faturas3",
  "parcelas-a-receber-modelo-1": "financeiro.receber.relatorio.modelo.parcelas1",
  "parcelas-a-receber-modelo-2": "financeiro.receber.relatorio.modelo.parcelas2",
  recebimentos: "financeiro.receber.relatorio.modelo.recebimentos",
  "recebimentos-completo": "financeiro.receber.relatorio.modelo.recebimentosCompleto",
  "extrato-individual": "financeiro.receber.relatorio.modelo.extrato1",
  "extrato-2-individual": "financeiro.receber.relatorio.modelo.extrato2",
  "extrato-3-agrupado-paciente": "financeiro.receber.relatorio.modelo.extrato3",
};

export function labelModeloRelatorioReceitasI18n(
  t: TradutorUi,
  value: ModeloRelatorioReceitas
) {
  return t(CHAVES_MODELO[value]);
}

export function chaveModeloRelatorioReceitas(
  value: ModeloRelatorioReceitas
): MessageKey {
  return CHAVES_MODELO[value];
}
