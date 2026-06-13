-- Execute no Neon (SQL Editor) se não rodar prisma db push após o deploy.
-- Histórico de passagem por etapas de produção (retrabalho / repetição).

CREATE TABLE IF NOT EXISTS "historico_etapas" (
  "id" TEXT NOT NULL,
  "trabalhoId" TEXT NOT NULL,
  "numeroOs" INTEGER NOT NULL,
  "clienteId" TEXT NOT NULL,
  "etapa" TEXT NOT NULL,
  "colaboradorId" TEXT,
  "colaboradorNome" TEXT,
  "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataSaida" TIMESTAMP(3),
  "observacao" TEXT,
  "motivoRetorno" TEXT,
  "itemId" TEXT,
  "tipoRepeticao" TEXT,
  "valorPrejuizo" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "descricaoItem" TEXT,
  CONSTRAINT "historico_etapas_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "historico_etapas" ADD COLUMN IF NOT EXISTS "tipoRepeticao" TEXT;
ALTER TABLE "historico_etapas" ADD COLUMN IF NOT EXISTS "valorPrejuizo" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "historico_etapas" ADD COLUMN IF NOT EXISTS "descricaoItem" TEXT;

CREATE INDEX IF NOT EXISTS "historico_etapas_trabalhoId_idx" ON "historico_etapas"("trabalhoId");
CREATE INDEX IF NOT EXISTS "historico_etapas_clienteId_idx" ON "historico_etapas"("clienteId");
CREATE INDEX IF NOT EXISTS "historico_etapas_numeroOs_idx" ON "historico_etapas"("numeroOs");
CREATE INDEX IF NOT EXISTS "historico_etapas_etapa_idx" ON "historico_etapas"("etapa");
CREATE INDEX IF NOT EXISTS "historico_etapas_dataEntrada_idx" ON "historico_etapas"("dataEntrada");
