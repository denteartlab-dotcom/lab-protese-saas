-- Senha do portal de acompanhamento (definida pelo admin do laboratório).
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "senhaPortalHash" TEXT;
