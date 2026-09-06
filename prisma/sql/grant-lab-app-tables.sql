-- Reaplica GRANT do lab_app em todas as tabelas/sequências do schema.
-- Rode após `prisma db push` quando o owner cria tabelas novas
-- (ex.: solicitacoes_envio_cliente) e o runtime usa DATABASE_URL_APP.

GRANT USAGE, CREATE ON SCHEMA public TO lab_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lab_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lab_app;

-- DEFAULT PRIVILEGES do usuário atual (quem executa este SQL / owner do push)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO lab_app;

-- Funções RLS (idempotente)
GRANT EXECUTE ON FUNCTION app_rls_bypass() TO lab_app;
GRANT EXECUTE ON FUNCTION app_current_tenant() TO lab_app;
GRANT EXECUTE ON FUNCTION app_tenant_matches(text) TO lab_app;
