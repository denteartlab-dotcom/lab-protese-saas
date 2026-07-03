import type { ProgressoBackupJob, ResultadoBackupExportJob, ResultadoBackupImportJob, ResultadoBackupServidorJob } from "@/lib/backup-job-schema";
import { aguardarJobCliente, ErroJobCliente, type OpcoesPollingJobCliente } from "@/lib/jobs/polling-cliente";

const TIMEOUT_BACKUP_MS = 10 * 60 * 1000;

function progressoBackupDeJob(resultado: unknown): ProgressoBackupJob | null {
  if (!resultado || typeof resultado !== "object") return null;
  const r = resultado as ProgressoBackupJob;
  if (!r.fase || typeof r.percentual !== "number") return null;
  return r;
}

function rotuloFaseBackup(fase: string): string {
  switch (fase) {
    case "iniciando":
      return "Iniciando…";
    case "exportando_dados":
      return "Exportando dados…";
    case "coletando_uploads":
      return "Coletando anexos…";
    case "compactando":
      return "Compactando ZIP…";
    case "gravando":
      return "Gravando no servidor…";
    case "sincronizando":
      return "Sincronizando nuvem…";
    case "importando":
      return "Restaurando dados…";
    case "finalizado":
      return "Concluído";
    default:
      return "Processando…";
  }
}

export async function exportarBackupComJob(
  opcoes?: OpcoesPollingJobCliente & {
    onFase?: (fase: string, percentual: number) => void;
  }
): Promise<ResultadoBackupExportJob> {
  const res = await fetch("/api/backup/export", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal: opcoes?.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.jobId) {
    throw new ErroJobCliente(data.error || "Não foi possível iniciar o backup.", "rede");
  }

  const job = await aguardarJobCliente(data.jobId, {
    ...opcoes,
    timeoutMs: opcoes?.timeoutMs ?? TIMEOUT_BACKUP_MS,
    onJob: (j) => {
      const parcial = progressoBackupDeJob(j.resultado);
      if (parcial) opcoes?.onFase?.(parcial.fase, parcial.percentual);
    },
  });

  const resultado = job.resultado as ResultadoBackupExportJob | undefined;
  if (!resultado?.downloadUrl) {
    throw new ErroJobCliente("Resposta de backup inválida.", "falhou");
  }
  return resultado;
}

export async function baixarBackupExportado(resultado: ResultadoBackupExportJob) {
  const res = await fetch(resultado.downloadUrl, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ErroJobCliente("Não foi possível baixar o arquivo de backup.", "rede");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = resultado.nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importarBackupComJob(
  requestInit: RequestInit,
  opcoes?: OpcoesPollingJobCliente & { onFase?: (fase: string, percentual: number) => void }
): Promise<ResultadoBackupImportJob> {
  const res = await fetch("/api/backup/import", {
    ...requestInit,
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal: opcoes?.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.jobId) {
    throw new ErroJobCliente(data.error || "Não foi possível iniciar a restauração.", "rede");
  }

  const job = await aguardarJobCliente(data.jobId, {
    ...opcoes,
    timeoutMs: opcoes?.timeoutMs ?? TIMEOUT_BACKUP_MS,
    onJob: (j) => {
      const parcial = progressoBackupDeJob(j.resultado);
      if (parcial) opcoes?.onFase?.(parcial.fase, parcial.percentual);
    },
  });

  const resultado = job.resultado as ResultadoBackupImportJob | undefined;
  if (!resultado?.contagens) {
    throw new ErroJobCliente("Resposta de restauração inválida.", "falhou");
  }
  return resultado;
}

export async function gerarBackupServidorComJob(
  opcoes?: OpcoesPollingJobCliente & { onFase?: (fase: string, percentual: number) => void }
): Promise<ResultadoBackupServidorJob> {
  const res = await fetch("/api/backup/executar-agora", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal: opcoes?.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.jobId) {
    throw new ErroJobCliente(data.error || "Não foi possível iniciar o backup no servidor.", "rede");
  }

  const job = await aguardarJobCliente(data.jobId, {
    ...opcoes,
    timeoutMs: opcoes?.timeoutMs ?? TIMEOUT_BACKUP_MS,
    onJob: (j) => {
      const parcial = progressoBackupDeJob(j.resultado);
      if (parcial) opcoes?.onFase?.(parcial.fase, parcial.percentual);
    },
  });

  const resultado = job.resultado as ResultadoBackupServidorJob | undefined;
  if (!resultado?.destino) {
    throw new ErroJobCliente("Resposta de backup no servidor inválida.", "falhou");
  }
  return resultado;
}

export { rotuloFaseBackup, ErroJobCliente };
