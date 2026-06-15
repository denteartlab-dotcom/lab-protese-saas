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
