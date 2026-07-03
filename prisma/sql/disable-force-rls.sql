-- Remove FORCE RLS (mantém ENABLE).
-- Owner/DATABASE_URL volta a operar normalmente.
-- Papel lab_app continua sujeito ao RLS (ENABLE sem BYPASSRLS).
-- Uso na VPS:
--   sudo -u postgres psql -d denteart_beta -f prisma/sql/disable-force-rls.sql

DO $fix$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tabela
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
  LOOP
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', r.tabela);
  END LOOP;
END
$fix$;
