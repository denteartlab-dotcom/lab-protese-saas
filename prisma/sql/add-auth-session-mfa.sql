-- Aditivo: revogação de sessão (sessionVersion) + MFA TOTP.
-- Seguro em bancos já populados — defaults mantêm acesso atual.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mfaSecretEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfaEnabledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mfaBackupCodesHash" TEXT;

ALTER TABLE "master_users"
  ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mfaSecretEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfaEnabledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mfaBackupCodesHash" TEXT;
