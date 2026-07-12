import type { MessageKey } from "@/lib/i18n";
import type { LinhaMatrizFluxoMensal } from "@/lib/fluxo-de-caixa";
import { trUi, type TradutorUi } from "@/lib/i18n/tr-ui";

const CHAVES_LINHA_FLUXO: Record<LinhaMatrizFluxoMensal["id"], MessageKey> = {
  saldo_inicial: "relatorio.fluxo.linha.saldoInicial",
  entradas: "relatorio.fluxo.linha.entradas",
  saidas: "relatorio.fluxo.linha.saidas",
  saldo_final: "relatorio.fluxo.linha.saldoFinal",
};

export function labelLinhaFluxoMensal(
  t: TradutorUi,
  id: LinhaMatrizFluxoMensal["id"],
  labelPt?: string
) {
  return t(CHAVES_LINHA_FLUXO[id]);
}

export function traduzirDescricaoFluxo(t: TradutorUi, descricao: string) {
  const d = (descricao || "").trim();
  if (!d) return d;
  if (d === "Saldo Inicial") return t("relatorio.fluxo.linha.saldoInicial");
  const cobranca = /^Cobrança OS\s+(\d+)/i.exec(d);
  if (cobranca) {
    return t("relatorio.fluxo.descricao.cobrancaOs", { os: cobranca[1] });
  }
  return trUi(d, t);
}

export function traduzirFormaPagamentoFluxo(t: TradutorUi, forma: string) {
  const f = (forma || "").trim();
  if (!f || f === "—") return f;
  if (f === "Movimentação") return t("relatorio.fluxo.forma.movimentacao");
  return trUi(f, t);
}
