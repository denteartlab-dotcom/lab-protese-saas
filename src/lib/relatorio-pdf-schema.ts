import { z } from "zod";

export const TIPOS_RELATORIO_PDF = ["dre", "fluxo-caixa"] as const;
export type TipoRelatorioPdf = (typeof TIPOS_RELATORIO_PDF)[number];

export function tipoRelatorioPdfValido(valor: string): valor is TipoRelatorioPdf {
  return (TIPOS_RELATORIO_PDF as readonly string[]).includes(valor);
}

export const schemaPayloadDrePdf = z.object({
  tipoRelatorio: z.enum(["resumo", "detalhado"]),
  mesIndex: z.number().int().min(0).max(11),
  ano: z.number().int().min(2000).max(2100),
  categorias: z.array(z.string()).optional(),
});

export const schemaPayloadFluxoCaixaPdf = z.object({
  conta: z.string(),
  tipo: z.string(),
  formaPagamento: z.string(),
  periodo: z.string(),
  dataInicio: z.string(),
  dataFim: z.string(),
  situacao: z.enum(["previsto", "realizado"]),
});

export const schemaJobRelatorioPdf = z.discriminatedUnion("relatorioTipo", [
  z.object({
    relatorioTipo: z.literal("dre"),
    params: schemaPayloadDrePdf,
  }),
  z.object({
    relatorioTipo: z.literal("fluxo-caixa"),
    params: schemaPayloadFluxoCaixaPdf,
  }),
]);

export type PayloadDrePdf = z.infer<typeof schemaPayloadDrePdf>;
export type PayloadFluxoCaixaPdf = z.infer<typeof schemaPayloadFluxoCaixaPdf>;
export type PayloadJobRelatorioPdf = z.infer<typeof schemaJobRelatorioPdf>;

export const MENSAGEM_RELATORIO_SEM_DADOS =
  "O relatório não possui dados para o período selecionado.";

export type ResultadoRelatorioPdfJob =
  | {
      semDados: false;
      pdfId: string;
      titulo: string;
      nomeArquivo: string;
      url: string;
    }
  | {
      semDados: true;
      titulo: string;
      mensagem: string;
    };
