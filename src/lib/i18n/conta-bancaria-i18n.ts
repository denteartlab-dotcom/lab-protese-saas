import type { Locale, MessageKey } from "@/lib/i18n";
import { htmlLangAttr } from "@/lib/i18n";
import {
  ID_CONTA_CAIXA,
  ID_CONTA_CARTEIRA,
  ID_CONTA_NF,
} from "@/lib/conta-bancaria";

const IDS_CONTAS_SISTEMA = new Set([
  ID_CONTA_CAIXA,
  ID_CONTA_CARTEIRA,
  ID_CONTA_NF,
]);

const CHAVE_TIPO_MOVIMENTACAO_ASAAS: Record<string, MessageKey> = {
  PAYMENT_FEE: "financeiro.conta.digital.tipo.paymentFee",
  PAYMENT_RECEIVED: "financeiro.conta.digital.tipo.paymentReceived",
  TRANSFER: "financeiro.conta.digital.tipo.transfer",
  TRANSFER_FEE: "financeiro.conta.digital.tipo.transferFee",
  BILL_PAYMENT: "financeiro.conta.digital.tipo.billPayment",
  BILL_PAYMENT_FEE: "financeiro.conta.digital.tipo.billPaymentFee",
  PAYMENT_MESSAGING_NOTIFICATION_FEE:
    "financeiro.conta.digital.tipo.paymentMessagingNotificationFee",
  INSTANT_TEXT_MESSAGE_FEE: "financeiro.conta.digital.tipo.instantTextMessageFee",
  PIX_TRANSACTION: "financeiro.conta.digital.tipo.pixTransaction",
  PIX_TRANSACTION_FEE: "financeiro.conta.digital.tipo.pixTransactionFee",
  PAYMENT_REFUNDED: "financeiro.conta.digital.tipo.paymentRefunded",
  CHARGEBACK: "financeiro.conta.digital.tipo.chargeback",
  INTERNAL_TRANSFER: "financeiro.conta.digital.tipo.internalTransfer",
  DEBIT: "financeiro.conta.digital.tipo.debit",
  CREDIT: "financeiro.conta.digital.tipo.credit",
};

function idAppContaBancaria(id: string): string {
  for (const appId of IDS_CONTAS_SISTEMA) {
    if (id === appId || id.endsWith(`:${appId}`)) return appId;
  }
  return id;
}

function chaveNomeContaBancariaSistema(appId: string): MessageKey {
  return `financeiro.conta.sistema.${appId.replace(/-/g, "_")}` as MessageKey;
}

/** Nome exibido na UI — traduz contas do sistema; contas do usuário mantêm o nome salvo. */
export function nomeExibicaoContaBancaria(
  conta: { id: string; nome: string },
  t: (key: MessageKey) => string
): string {
  const appId = idAppContaBancaria(conta.id);
  if (!IDS_CONTAS_SISTEMA.has(appId)) return conta.nome;
  return t(chaveNomeContaBancariaSistema(appId));
}

export function formatMoedaContaBancaria(value: number, locale: Locale): string {
  return value.toLocaleString(htmlLangAttr(locale), {
    style: "currency",
    currency: "BRL",
  });
}

export function labelTipoMovimentacaoAsaas(
  type: string,
  t: (key: MessageKey) => string
): string {
  const chave = CHAVE_TIPO_MOVIMENTACAO_ASAAS[type];
  if (chave) return t(chave);
  return type.replace(/_/g, " ");
}
