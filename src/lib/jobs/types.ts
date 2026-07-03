/** Status de um job assíncrono (issue 002). */
export type StatusJob = "pendente" | "executando" | "concluido" | "falhou";

export const TIPOS_JOB = [
  "importar_clientes",
  "importar_fornecedores",
  "import_ofx",
  "conciliacao_conta",
  "backup_export",
  "backup_import",
  "backup_servidor",
  "webhook_mercadopago_assinatura",
  "webhook_asaas_assinatura",
  "sincronizar_pagamento_assinatura",
  "emitir_boleto_asaas",
  "emitir_nfse",
  "aplicar_orcamento",
] as const;
export type TipoJob = (typeof TIPOS_JOB)[number];

export function tipoJobValido(valor: string): valor is TipoJob {
  return (TIPOS_JOB as readonly string[]).includes(valor);
}

export type JobRespostaPublica = {
  jobId: string;
  tipo: string;
  status: StatusJob;
  progresso: number;
  resultado?: unknown;
  erro?: string | null;
  criadoEm: string;
  concluidoEm?: string | null;
};

export type CriarJobResposta = {
  jobId: string;
  status: StatusJob;
};

export type ContextoExecucaoJob = {
  jobId: string;
  empresaId: string;
  payload: unknown;
  reportarProgresso: (progresso: number) => Promise<void>;
};

export type ManipuladorJob = (ctx: ContextoExecucaoJob) => Promise<unknown>;
