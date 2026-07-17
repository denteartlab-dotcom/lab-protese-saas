-- Remove FORCE RLS de todas as tabelas forçadas no schema atual (rollback).
-- Políticas RLS continuam ativas,
-- mas o owner (smartuser) volta a ignorá-las — app pode usar DATABASE_URL de novo.

DO $noforce$
DECLARE
  tabela record;
BEGIN
  FOR tabela IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relkind IN ('r', 'p')
      AND c.relforcerowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', tabela.relname);
  END LOOP;
END
$noforce$;
