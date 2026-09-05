-- RLS multi-tenant — Lab Prótese SaaS
-- Variáveis de sessão (SET LOCAL em transação):
--   app.current_tenant = empresaId (cuid)
--   app.rls_bypass = 'true' | 'false'

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.rls_bypass', true), 'false') = 'true';
$$;

CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '');
$$;

CREATE OR REPLACE FUNCTION app_tenant_matches(empresa_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_rls_bypass()
    OR (app_current_tenant() IS NOT NULL AND empresa_id = app_current_tenant());
$$;

ALTER TABLE "Empresa" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
DROP POLICY IF EXISTS tenant_empresa ON "Empresa";
CREATE POLICY tenant_empresa ON "Empresa"
  FOR ALL USING (app_rls_bypass() OR id = app_current_tenant())
  WITH CHECK (app_rls_bypass() OR id = app_current_tenant());

DO $rls$
DECLARE
  t text;
  tables text[] := ARRAY[
    'User', 'Cliente', 'Trabalho', 'Produto', 'Lancamento', 'Orcamento',
    'ArquivoUpload', 'ContaBancaria', 'SequenciaNumerica', 'AsaasSubconta',
    'job_execucoes', 'suporte_conversas', 'cobrancas_assinatura',
    'solicitacoes_envio_cliente'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- FORCE removido (lab_app ainda respeita ENABLE ROW LEVEL SECURITY)
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL
         USING (app_tenant_matches("empresaId"))
         WITH CHECK (app_tenant_matches("empresaId"))',
      t
    );
  END LOOP;
END
$rls$;

DROP POLICY IF EXISTS tenant_isolation ON "LogAuditoria";
ALTER TABLE "LogAuditoria" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
CREATE POLICY tenant_isolation ON "LogAuditoria"
  FOR ALL USING (
    app_rls_bypass()
    OR ("empresaId" IS NOT NULL AND app_tenant_matches("empresaId"))
  )
  WITH CHECK (
    app_rls_bypass()
    OR ("empresaId" IS NOT NULL AND app_tenant_matches("empresaId"))
  );

DROP POLICY IF EXISTS tenant_isolation ON "historico_etapas";
ALTER TABLE "historico_etapas" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
CREATE POLICY tenant_isolation ON "historico_etapas"
  FOR ALL USING (
    app_rls_bypass()
    OR ("empresaId" IS NOT NULL AND app_tenant_matches("empresaId"))
  )
  WITH CHECK (
    app_rls_bypass()
    OR ("empresaId" IS NOT NULL AND app_tenant_matches("empresaId"))
  );

DROP POLICY IF EXISTS tenant_isolation ON "NfseEmissao";
ALTER TABLE "NfseEmissao" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
CREATE POLICY tenant_isolation ON "NfseEmissao"
  FOR ALL USING (
    app_rls_bypass()
    OR ("empresaId" IS NOT NULL AND app_tenant_matches("empresaId"))
  )
  WITH CHECK (
    app_rls_bypass()
    OR ("empresaId" IS NOT NULL AND app_tenant_matches("empresaId"))
  );

ALTER TABLE "JsonStore" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
DROP POLICY IF EXISTS tenant_json_store ON "JsonStore";
CREATE POLICY tenant_json_store ON "JsonStore"
  FOR ALL USING (
    app_rls_bypass()
    OR (
      app_current_tenant() IS NOT NULL
      AND key LIKE 't:' || app_current_tenant() || ':%'
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR (
      app_current_tenant() IS NOT NULL
      AND key LIKE 't:' || app_current_tenant() || ':%'
    )
  );

ALTER TABLE "Paciente" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
DROP POLICY IF EXISTS tenant_paciente ON "Paciente";
CREATE POLICY tenant_paciente ON "Paciente"
  FOR ALL USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Cliente" c
      WHERE c.id = "Paciente"."clienteId"
        AND app_tenant_matches(c."empresaId")
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Cliente" c
      WHERE c.id = "Paciente"."clienteId"
        AND app_tenant_matches(c."empresaId")
    )
  );

ALTER TABLE "MovimentacaoConta" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
DROP POLICY IF EXISTS tenant_movimentacao ON "MovimentacaoConta";
CREATE POLICY tenant_movimentacao ON "MovimentacaoConta"
  FOR ALL USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "ContaBancaria" cb
      WHERE cb.id = "MovimentacaoConta"."contaId"
        AND app_tenant_matches(cb."empresaId")
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "ContaBancaria" cb
      WHERE cb.id = "MovimentacaoConta"."contaId"
        AND app_tenant_matches(cb."empresaId")
    )
  );

ALTER TABLE "ExtratoMovimentacao" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
DROP POLICY IF EXISTS tenant_extrato ON "ExtratoMovimentacao";
CREATE POLICY tenant_extrato ON "ExtratoMovimentacao"
  FOR ALL USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "ContaBancaria" cb
      WHERE cb.id = "ExtratoMovimentacao"."contaId"
        AND app_tenant_matches(cb."empresaId")
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "ContaBancaria" cb
      WHERE cb.id = "ExtratoMovimentacao"."contaId"
        AND app_tenant_matches(cb."empresaId")
    )
  );

ALTER TABLE "CobrancaAsaas" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
DROP POLICY IF EXISTS tenant_cobranca_asaas ON "CobrancaAsaas";
CREATE POLICY tenant_cobranca_asaas ON "CobrancaAsaas"
  FOR ALL USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lancamento" l
      WHERE l.id = "CobrancaAsaas"."lancamentoId"
        AND app_tenant_matches(l."empresaId")
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Lancamento" l
      WHERE l.id = "CobrancaAsaas"."lancamentoId"
        AND app_tenant_matches(l."empresaId")
    )
  );

ALTER TABLE "suporte_mensagens" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
DROP POLICY IF EXISTS tenant_suporte_msg ON "suporte_mensagens";
CREATE POLICY tenant_suporte_msg ON "suporte_mensagens"
  FOR ALL USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "suporte_conversas" sc
      WHERE sc.id = "suporte_mensagens"."conversaId"
        AND app_tenant_matches(sc."empresaId")
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "suporte_conversas" sc
      WHERE sc.id = "suporte_mensagens"."conversaId"
        AND app_tenant_matches(sc."empresaId")
    )
  );

ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
DROP POLICY IF EXISTS tenant_password_reset ON "PasswordResetToken";
CREATE POLICY tenant_password_reset ON "PasswordResetToken"
  FOR ALL USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "PasswordResetToken"."userId"
        AND app_tenant_matches(u."empresaId")
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "PasswordResetToken"."userId"
        AND app_tenant_matches(u."empresaId")
    )
  );

ALTER TABLE "CadastroVerificacaoEmail" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
DROP POLICY IF EXISTS bypass_only_cadastro_email ON "CadastroVerificacaoEmail";
CREATE POLICY bypass_only_cadastro_email ON "CadastroVerificacaoEmail"
  FOR ALL USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

ALTER TABLE "master_users" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
DROP POLICY IF EXISTS bypass_only_master_users ON "master_users";
CREATE POLICY bypass_only_master_users ON "master_users"
  FOR ALL USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

ALTER TABLE "master_audit_logs" ENABLE ROW LEVEL SECURITY;
-- FORCE removido: owner da app (DATABASE_URL) precisa operar; lab_app continua com RLS via ENABLE
DROP POLICY IF EXISTS bypass_only_master_audit ON "master_audit_logs";
CREATE POLICY bypass_only_master_audit ON "master_audit_logs"
  FOR ALL USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- WhatsApp: isolamento por tenant (telefones, campanhas e conversas)
DO $wa$
DECLARE
  t text;
  tables_empresa text[] := ARRAY[
    'whatsapp_sessions',
    'whatsapp_campaigns',
    'whatsapp_logs',
    'whatsapp_chat_conversas',
    'whatsapp_chatbot_configs'
  ];
BEGIN
  FOREACH t IN ARRAY tables_empresa LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL
         USING (app_tenant_matches("empresaId"))
         WITH CHECK (app_tenant_matches("empresaId"))',
      t
    );
  END LOOP;
END
$wa$;

ALTER TABLE "whatsapp_campaign_contacts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "whatsapp_campaign_contacts";
CREATE POLICY tenant_isolation ON "whatsapp_campaign_contacts"
  FOR ALL USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "whatsapp_campaigns" c
      WHERE c.id = "whatsapp_campaign_contacts"."campaignId"
        AND app_tenant_matches(c."empresaId")
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "whatsapp_campaigns" c
      WHERE c.id = "whatsapp_campaign_contacts"."campaignId"
        AND app_tenant_matches(c."empresaId")
    )
  );

ALTER TABLE "whatsapp_chat_mensagens" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "whatsapp_chat_mensagens";
CREATE POLICY tenant_isolation ON "whatsapp_chat_mensagens"
  FOR ALL USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "whatsapp_chat_conversas" c
      WHERE c.id = "whatsapp_chat_mensagens"."conversaId"
        AND app_tenant_matches(c."empresaId")
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "whatsapp_chat_conversas" c
      WHERE c.id = "whatsapp_chat_mensagens"."conversaId"
        AND app_tenant_matches(c."empresaId")
    )
  );
