import { z } from "zod";
import { schemaNomeCliente } from "@/lib/cliente-validacao";
import type { ResultadoImportacaoExcel } from "@/lib/importacao-excel-schema";

export const clienteImportSchema = z.object({
  nome: z.string(),
  razaoSocial: z.string().optional(),
  cnpjCpf: z.string().optional(),
  cro: z.string().optional(),
  telefone: z.string().optional(),
  celular: z.string().optional(),
  email: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  cep: z.string().optional(),
  observacoes: z.string().optional(),
});

export const schemaImportacaoClientes = z.object({
  clientes: z.array(clienteImportSchema).min(1).max(1000),
});

export type ClienteImportPayload = z.infer<typeof clienteImportSchema>;

export type ResultadoImportacaoClientes = ResultadoImportacaoExcel & {
  /** Alias de `ok` — compatibilidade com telas antigas. */
  importados: number;
};
