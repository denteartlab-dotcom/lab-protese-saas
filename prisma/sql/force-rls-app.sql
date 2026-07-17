-- Aplica FORCE ROW LEVEL SECURITY em todas as tabelas com RLS no schema atual.
-- Pré-requisito: npm run db:rls + npm run db:role-app + DATABASE_URL_APP apontando para lab_app.
-- Com FORCE, o owner também respeita as policies — a app NÃO pode usar DATABASE_URL owner.

DO $force$
DECLARE
  tabela record;
BEGIN
  FOR tabela IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabela.relname);
  END LOOP;
END
$force$;
