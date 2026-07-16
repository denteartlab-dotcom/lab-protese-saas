-- Remove FORCE RLS (emergência / rollback). Políticas RLS podem continuar ativas,
-- mas o owner (smartuser) volta a ignorá-las — app pode usar DATABASE_URL de novo.

DO $noforce$
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
      EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Tabela % inexistente — pulando', t;
    END;
  END LOOP;
END
$noforce$;
