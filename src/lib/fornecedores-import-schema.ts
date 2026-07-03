import { z } from "zod";
import type { ResultadoImportacaoExcel } from "@/lib/importacao-excel-schema";

export const fornecedorImportSchema = z.object({
  nome: z.string(),
  contato: z.string().optional(),
  celular: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  categoria: z.string().optional(),
  telefoneResidencial: z.string().optional(),
  telefoneComercial: z.string().optional(),
  cep: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  bairro: z.string().optional(),
  complemento: z.string().optional(),
  representanteTelefoneComercial: z.string().optional(),
  representanteWhatsapp: z.string().optional(),
  representanteEmail: z.string().optional(),
});

export const schemaImportacaoFornecedores = z.object({
  fornecedores: z.array(fornecedorImportSchema).min(1).max(1000),
});

export type FornecedorImportPayload = z.infer<typeof fornecedorImportSchema>;

export type FornecedorImportadoServidor = {
  id: string;
  nome: string;
  contato: string;
  celular: string;
  whatsapp: string;
  email: string;
  cpf?: string;
  cnpj?: string;
  categoria?: string;
  telefoneResidencial?: string;
  telefoneComercial?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
  bairro?: string;
  complemento?: string;
  representanteTelefoneComercial?: string;
  representanteWhatsapp?: string;
  representanteEmail?: string;
};

export type ResultadoImportacaoFornecedores = ResultadoImportacaoExcel;
