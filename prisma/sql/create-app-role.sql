-- Papel da aplicação (sem superuser) — RLS passa a valer de verdade.
-- Rode com DIRECT_URL (owner/superuser): npm run db:role-app
-- Depois crie DATABASE_URL_APP no .env e use na aplicação.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lab_app') THEN
    CREATE ROLE lab_app LOGIN PASSWORD 'lab_app_dev_trocar_em_producao';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO lab_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lab_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lab_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO lab_app;

-- Funções RLS
GRANT EXECUTE ON FUNCTION app_rls_bypass() TO lab_app;
GRANT EXECUTE ON FUNCTION app_current_tenant() TO lab_app;
GRANT EXECUTE ON FUNCTION app_tenant_matches(text) TO lab_app;
