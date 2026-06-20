import { PIX_ASSINATURA_QR_EXPIRACAO_MS } from "@/lib/assinatura-pix-constants";
import { asaasPlataformaConfigurado } from "@/lib/asaas-plataforma-config";
import { mercadoPagoPlataformaConfigurado } from "@/lib/mercadopago-plataforma-config";

export type ProvedorPixAssinatura = "mercadopago" | "asaas";

const STATUS_PAGO_ASAAS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
const STATUS_PENDENTE_MP = new Set(["pending", "in_process", "PENDING"]);

export function resolverProvedorPixAssinatura(): ProvedorPixAssinatura | null {
  if (mercadoPagoPlataformaConfigurado()) return "mercadopago";
  if (asaasPlataformaConfigurado()) return "asaas";
  return null;
}

export function statusCobrancaAssinaturaPago(
  provedor: string,
  status: string
): boolean {
  if (provedor === "mercadopago") return status === "approved";
  return STATUS_PAGO_ASAAS.has(status);
}

export function statusCobrancaAssinaturaPendente(
  provedor: string,
  status: string
): boolean {
  if (provedor === "mercadopago") {
    return STATUS_PENDENTE_MP.has(status.toLowerCase());
  }
  return status === "PENDING";
}

/** PIX ainda aguardando pagamento (não pago e QR/cobrança não expirou). */
export function cobrancaAssinaturaPixAberta(cobranca: {
  provedor: string;
  statusAsaas: string;
  pixExpiraEm: Date | null;
  createdAt: Date;
  pagoEm?: Date | null;
}): boolean {
  if (cobranca.pagoEm) return false;
  if (statusCobrancaAssinaturaPago(cobranca.provedor, cobranca.statusAsaas)) {
    return false;
  }
  if (!statusCobrancaAssinaturaPendente(cobranca.provedor, cobranca.statusAsaas)) {
    return false;
  }
  if (cobranca.pixExpiraEm && cobranca.pixExpiraEm.getTime() < Date.now()) {
    return false;
  }
  const limite = Date.now() - PIX_ASSINATURA_QR_EXPIRACAO_MS;
  if (!cobranca.pixExpiraEm && cobranca.createdAt.getTime() < limite) {
    return false;
  }
  return true;
}
