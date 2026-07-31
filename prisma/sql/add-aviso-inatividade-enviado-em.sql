-- Aviso de exclusão por inatividade (3 dias antes).
ALTER TABLE "Empresa"
  ADD COLUMN IF NOT EXISTS "avisoInatividadeEnviadoEm" TIMESTAMP(3);
