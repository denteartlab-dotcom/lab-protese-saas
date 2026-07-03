import { ZodError } from "zod";
import { atualizarJob, obterJobTenant } from "@/lib/jobs/store";
import { manipularJobBackupExport } from "@/lib/jobs/handlers/backup-export";
import { manipularJobBackupImport } from "@/lib/jobs/handlers/backup-import";
import { manipularJobBackupServidor } from "@/lib/jobs/handlers/backup-servidor";
import { manipularJobImportarFornecedores } from "@/lib/jobs/handlers/import-fornecedores";
import { manipularJobConciliacaoConta } from "@/lib/jobs/handlers/conciliacao-conta";
import { manipularJobImportOfx } from "@/lib/jobs/handlers/import-ofx";
import { manipularJobAplicarOrcamento } from "@/lib/jobs/handlers/aplicar-orcamento";
import { manipularJobEmitirBoletoAsaas } from "@/lib/jobs/handlers/emitir-boleto-asaas";
import { manipularJobEmitirNfse } from "@/lib/jobs/handlers/emitir-nfse";
import { manipularJobImportarClientes } from "@/lib/jobs/handlers/import-clientes";
import { manipularJobSincronizarPagamentoAssinatura } from "@/lib/jobs/handlers/sincronizar-pagamento-assinatura";
import { manipularJobWebhookAsaasAssinatura } from "@/lib/jobs/handlers/webhook-asaas-assinatura";
import { manipularJobWebhookMercadoPagoAssinatura } from "@/lib/jobs/handlers/webhook-mercadopago-assinatura";
import type { ManipuladorJob, TipoJob } from "@/lib/jobs/types";

const manipuladores: Record<TipoJob, ManipuladorJob> = {
  importar_clientes: manipularJobImportarClientes,
  importar_fornecedores: manipularJobImportarFornecedores,
  import_ofx: manipularJobImportOfx,
  conciliacao_conta: manipularJobConciliacaoConta,
  backup_export: manipularJobBackupExport,
  backup_import: manipularJobBackupImport,
  backup_servidor: manipularJobBackupServidor,
  webhook_mercadopago_assinatura: manipularJobWebhookMercadoPagoAssinatura,
  webhook_asaas_assinatura: manipularJobWebhookAsaasAssinatura,
  sincronizar_pagamento_assinatura: manipularJobSincronizarPagamentoAssinatura,
  emitir_boleto_asaas: manipularJobEmitirBoletoAsaas,
  emitir_nfse: manipularJobEmitirNfse,
  aplicar_orcamento: manipularJobAplicarOrcamento,
};

function mensagemErroJob(erro: unknown): string {
  if (erro instanceof ZodError) {
    return "Dados do job inválidos.";
  }
  if (erro instanceof Error && erro.message.trim()) {
    return erro.message.trim();
  }
  return "Falha ao executar o job.";
}

export async function executarJob(jobId: string, empresaId: string) {
  const job = await obterJobTenant(empresaId, jobId);
  if (!job) return;
  if (job.status !== "pendente") return;

  const tipo = job.tipo as TipoJob;
  const manipulador = manipuladores[tipo];
  if (!manipulador) {
    await atualizarJob(jobId, {
      status: "falhou",
      erro: `Tipo de job não suportado: ${job.tipo}`,
      concluidoEm: new Date(),
    });
    return;
  }

  await atualizarJob(jobId, { status: "executando", progresso: 0, erro: null });

  try {
    const payload = JSON.parse(job.payload) as unknown;
    const resultado = await manipulador({
      jobId,
      empresaId,
      payload,
      reportarProgresso: async (progresso) => {
        await atualizarJob(jobId, { progresso });
      },
    });

    await atualizarJob(jobId, {
      status: "concluido",
      progresso: 100,
      resultado,
      erro: null,
      concluidoEm: new Date(),
    });
  } catch (erro) {
    console.error(`[jobs] falha job ${jobId} (${tipo})`, erro);
    await atualizarJob(jobId, {
      status: "falhou",
      erro: mensagemErroJob(erro),
      concluidoEm: new Date(),
    });
  }
}

/** Dispara execução sem bloquear a resposta HTTP. */
export function executarJobEmBackground(jobId: string, empresaId: string) {
  setImmediate(() => {
    void executarJob(jobId, empresaId);
  });
}
