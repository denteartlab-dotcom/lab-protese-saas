-- Aplica FORCE ROW LEVEL SECURITY em todas as tabelas com RLS.
-- Pré-requisito: npm run db:rls + npm run db:role-app + DATABASE_URL_APP apontando para lab_app.
-- Com FORCE, o owner também respeita as policies — a app NÃO pode usar DATABASE_URL owner.

DO $force$
DECLARE
  t text;
  tables text[] := ARRAY[
    'Empresa', 'User', 'Cliente', 'Trabalho', 'Produto', 'Lancamento', 'Orcamento',
    'ArquivoUpload', 'ContaBancaria', 'SequenciaNumerica', 'AsaasSubconta',
    'job_execucoes', 'suporte_conversas', 'cobrancas_assinatura',
    'LogAuditoria', 'historico_etapas', 'NfseEmissao', 'JsonStore',
    'Paciente', 'MovimentacaoConta', 'ExtratoMovimentacao', 'CobrancaAsaas',
    'suporte_mensagens', 'PasswordResetToken', 'CadastroVerificacaoEmail',
    'master_users', 'master_audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Tabela % inexistente — pulando FORCE', t;
    END;
  END LOOP;
END
$force$;
