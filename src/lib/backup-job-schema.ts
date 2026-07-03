import { z } from "zod";

export const FASES_BACKUP = [
  "iniciando",
  "exportando_dados",
  "coletando_uploads",
  "compactando",
  "gravando",
  "sincronizando",
  "importando",
  "finalizado",
] as const;

export type FaseBackup = (typeof FASES_BACKUP)[number];

export type ProgressoBackupJob = {
  fase: FaseBackup;
  percentual: number;
  arquivo?: string;
};

export type ResultadoBackupExportJob = {
  fase: "finalizado";
  percentual: 100;
  downloadUrl: string;
  nomeArquivo: string;
  exportedAt: string;
};

export type ResultadoBackupImportJob = {
  fase: "finalizado";
  percentual: 100;
  exportedAt: string;
  empresaSlug: string;
  contagens: Record<string, number>;
  uploadsRestaurados: number;
  excluirDre: boolean;
};

export type ResultadoBackupServidorJob = {
  fase: "finalizado";
  percentual: 100;
  destino: string;
  exportedAt: string;
  uploadsArquivos: number;
  pastaUploads?: string;
};

export const schemaJobBackupExport = z.object({
  empresaSlug: z.string().min(1),
});

export const schemaJobBackupImport = z.object({
  stagingId: z.string().min(1),
  excluirDre: z.boolean().optional(),
  empresaSlug: z.string().min(1),
});

export const schemaJobBackupServidor = z.object({
  empresaSlug: z.string().min(1),
  empresaNome: z.string().optional(),
});
