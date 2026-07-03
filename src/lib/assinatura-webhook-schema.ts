import { z } from "zod";

export const schemaJobWebhookMercadoPago = z.object({
  paymentId: z.string().min(1),
  chaveIdempotencia: z.string().min(1),
});

export const schemaJobWebhookAsaas = z.object({
  chaveIdempotencia: z.string().min(1),
  evento: z.string().min(1),
  paymentId: z.string().optional(),
  status: z.string().optional(),
  accountId: z.string().optional(),
  accountStatus: z
    .object({
      general: z.string().optional(),
      documentation: z.string().optional(),
    })
    .optional(),
});

export const schemaJobSincronizarPagamentoAssinatura = z.object({
  cobrancaId: z.string().min(1),
  paymentId: z.string().min(1),
  provedor: z.string().optional(),
});
