import { z } from "zod";

export const schemaJobEmitirBoletoAsaas = z.object({
  lancamentoId: z.string().min(1),
});

export const schemaJobEmitirNfse = z.object({
  clienteId: z.string().min(1),
  valor: z.number().positive(),
  descricao: z.string().optional(),
  lancamentoId: z.string().optional(),
});

export const schemaJobAplicarOrcamento = z.object({
  orcamentoId: z.string().min(1),
});
