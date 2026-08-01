-- Permite arquivar cliente com vínculos sem apagar pacientes/OS/lançamentos.
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "removidoEm" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Cliente_removidoEm_idx" ON "Cliente"("removidoEm");
