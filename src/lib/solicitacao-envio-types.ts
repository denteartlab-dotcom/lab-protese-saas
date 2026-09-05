import { z } from "zod";

export const TIPOS_TRANSPORTE_SOLICITACAO = [
  "motoboy",
  "correios",
  "retirada_laboratorio",
  "outro",
] as const;

export type TipoTransporteSolicitacao =
  (typeof TIPOS_TRANSPORTE_SOLICITACAO)[number];

export const STATUS_SOLICITACAO_ENVIO = [
  "pendente",
  "aprovada",
  "recusada",
] as const;

export type StatusSolicitacaoEnvio =
  (typeof STATUS_SOLICITACAO_ENVIO)[number];

export const LIMITE_IMAGENS_SOLICITACAO_ENVIO = 10;
export const LIMITE_ARQUIVOS_SOLICITACAO_ENVIO = 10;
export const LIMITE_ANEXOS_SOLICITACAO_ENVIO =
  LIMITE_IMAGENS_SOLICITACAO_ENVIO + LIMITE_ARQUIVOS_SOLICITACAO_ENVIO;

export type CategoriaAnexoSolicitacao = "imagem" | "arquivo";

export type AnexoSolicitacaoEnvio = {
  id: string;
  nome: string;
  mimeType: string;
  url: string;
  tamanho: number;
  categoria?: CategoriaAnexoSolicitacao;
};

export type ObservacaoEnvioLinha = {
  id: string;
  texto: string;
};

export const schemaObservacaoEnvioLinha = z.object({
  id: z.string().min(1).max(64),
  texto: z.string().trim().max(500),
});

export const schemaAnexoSolicitacao = z.object({
  id: z.string().min(1).max(64),
  nome: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  url: z.string().trim().min(1).max(500),
  tamanho: z.number().int().min(0).max(50 * 1024 * 1024),
  categoria: z.enum(["imagem", "arquivo"]).optional(),
});

export const schemaCriarSolicitacaoEnvio = z.object({
  pacienteNome: z.string().trim().min(1).max(180),
  dentista: z.string().trim().max(180).optional().default(""),
  caixa: z.string().trim().max(80).optional().default(""),
  casoClinico: z.string().trim().max(200).optional().default(""),
  prioridade: z.enum(["alta", "media", "baixa"]).optional().default("media"),
  urgente: z.boolean().optional().default(false),
  repeticao: z.boolean().optional().default(false),
  materialEnviado: z.string().trim().max(500).optional().default(""),
  dataDesejada: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  tipoProtese: z.string().trim().min(1).max(240),
  observacaoInterna: z.string().trim().max(2000).optional().default(""),
  observacaoServico: z.string().trim().max(2000).optional().default(""),
  escala: z.string().trim().max(80).optional().default(""),
  cor: z.string().trim().max(80).optional().default(""),
  dentes: z.string().trim().max(120).optional().default(""),
  valorEstimado: z.number().min(0).max(1_000_000).optional().default(0),
  tipoTransporte: z.enum(TIPOS_TRANSPORTE_SOLICITACAO),
  observacoesEnvio: z.array(schemaObservacaoEnvioLinha).max(30).optional().default([]),
  anexos: z
    .array(schemaAnexoSolicitacao)
    .max(LIMITE_ANEXOS_SOLICITACAO_ENVIO)
    .optional()
    .default([]),
});

export type CriarSolicitacaoEnvioInput = z.infer<typeof schemaCriarSolicitacaoEnvio>;

export function rotuloTipoTransporte(tipo: string): string {
  switch (tipo) {
    case "motoboy":
      return "Motoboy";
    case "correios":
      return "Correios";
    case "retirada_laboratorio":
      return "Retirada no laboratório";
    case "outro":
      return "Outro";
    default:
      return tipo || "—";
  }
}

export function categoriaAnexoPorMime(mimeType: string): CategoriaAnexoSolicitacao {
  return mimeType.startsWith("image/") ? "imagem" : "arquivo";
}

export function parseJsonArraySeguro<T>(raw: string | null | undefined): T[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
