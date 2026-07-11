import type { MessageKey } from "@/lib/i18n";
import type { GrupoBoletoTabela } from "@/lib/controle-boletos";
import { labelStatusBoleto as labelStatusBoletoLib } from "@/lib/controle-boletos";
import type { LinhaBoleto } from "@/lib/controle-boletos";

type Tradutor = (key: MessageKey, params?: Record<string, string | number>) => string;

const CHAVES_GRUPO: Record<GrupoBoletoTabela, MessageKey> = {
  vencidos: "financeiro.boletos.grupo.vencidos",
  proximos: "financeiro.boletos.grupo.proximos",
  pagos: "financeiro.boletos.grupo.pagos",
};

export function labelGrupoBoleto(t: Tradutor, grupo: GrupoBoletoTabela): string {
  return t(CHAVES_GRUPO[grupo]);
}

export function labelStatusBoletoI18n(t: Tradutor, linha: LinhaBoleto): string {
  if (linha.lancamento.status === "pago") return t("financeiro.boletos.status.pago");
  if (linha.grupo === "vencidos") return t("financeiro.boletos.status.vencido");
  if (linha.emAnalise) return t("financeiro.boletos.status.emAnalise");
  return t("financeiro.boletos.status.aguardando");
}

export function textoDiasVencimentoBoleto(
  t: Tradutor,
  linha: LinhaBoleto
): string {
  if (linha.grupo === "vencidos") {
    return t("financeiro.boletos.diasAtraso", { dias: Math.abs(linha.diasAteVencimento) });
  }
  if (linha.diasAteVencimento === 0) return t("financeiro.boletos.venceHoje");
  return t("financeiro.boletos.emDias", { dias: linha.diasAteVencimento });
}

/** Fallback para código legado que ainda chama labelStatusBoleto da lib. */
export function labelStatusBoletoLegado(linha: LinhaBoleto): string {
  return labelStatusBoletoLib(linha);
}
