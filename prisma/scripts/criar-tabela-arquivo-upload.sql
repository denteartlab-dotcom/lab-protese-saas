-- Execute no Neon (SQL Editor) se não rodar prisma db push após o deploy.
-- Anexos de despesas/receitas/OS na produção (Vercel).

CREATE TABLE IF NOT EXISTS "ArquivoUpload" (
  "id" TEXT NOT NULL,
  "pasta" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
  "tamanho" INTEGER NOT NULL,
  "dados" BYTEA NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArquivoUpload_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ArquivoUpload_pasta_idx" ON "ArquivoUpload"("pasta");
