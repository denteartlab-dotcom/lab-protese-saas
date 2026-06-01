-- Permite vários serviços na mesma OS (mesmo numeroOs + segmento "servico").
-- Execute no Neon/SQL antes ou depois do prisma db push.

ALTER TABLE "Trabalho" DROP CONSTRAINT IF EXISTS "Trabalho_numeroOs_segmentoFaturamento_key";

DROP INDEX IF EXISTS "Trabalho_numeroOs_segmentoFaturamento_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Trabalho_numeroOs_segmentoFaturamento_tipoProtese_key"
  ON "Trabalho" ("numeroOs", "segmentoFaturamento", "tipoProtese");
