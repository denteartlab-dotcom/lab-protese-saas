import type { MessageKey } from "@/lib/i18n";
import type { ModeloRelatorioEntregas } from "@/lib/relatorio-entregas-tipos";
import type { SituacaoEntrega } from "@/lib/controle-entregas";
import { trUi, type TradutorUi } from "@/lib/i18n/tr-ui";

const CHAVES_MODELO: Record<ModeloRelatorioEntregas, MessageKey> = {
  "entregas-modelo-1": "relatorio.entregas.modelo1",
  "entregas-modelo-2": "relatorio.entregas.modelo2",
  "entregas-modelo-3": "relatorio.entregas.modelo3",
  "entregas-pendentes": "relatorio.entregas.modeloPendentes",
  "entregas-em-rota": "relatorio.entregas.modeloEmRota",
  "entregas-finalizadas": "relatorio.entregas.modeloFinalizadas",
};

export function labelModeloEntregas(t: TradutorUi, value: ModeloRelatorioEntregas) {
  return t(CHAVES_MODELO[value]);
}

export function labelSituacaoEntrega(
  t: TradutorUi,
  key: SituacaoEntrega,
  labelPt: string
) {
  const chave = `relatorio.entregas.situacao.${key}` as MessageKey;
  const traduzido = t(chave);
  if (traduzido !== chave) return traduzido;
  return trUi(labelPt, t);
}
