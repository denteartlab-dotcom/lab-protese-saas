import type {
  ProgressoBackupJob,
  ResultadoBackupExportJob,
  ResultadoBackupImportJob,
  ResultadoBackupServidorJob,
} from "@/lib/backup-job-schema";
import {
  aguardarJobCliente,
  ErroJobCliente,
  type OpcoesPollingJobCliente,
} from "@/lib/jobs/polling-cliente";

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

function nomeArquivoDeContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1].trim());
    } catch {
      return utf[1].trim();
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header) || /filename=([^;]+)/i.exec(header);
  return plain?.[1]?.trim().replace(/^["']|["']$/g, "") || null;
}

function dispararDownloadBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2_000);
}

/**
 * Gera e baixa o ZIP completo (backup.json + uploads/) direto da API.
 * Mesmo comportamento de antes do fluxo por job.
 */
export async function exportarBackupComJob(
  opcoes?: OpcoesPollingJobCliente & {
    onFase?: (fase: string, percentual: number) => void;
  }
): Promise<ResultadoBackupExportJob> {
  opcoes?.onFase?.("exportando_dados", 20);

  const res = await fetch("/api/backup/export", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: opcoes?.signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ErroJobCliente(
      (data as { error?: string }).error || "Não foi possível exportar o backup.",
      "rede"
    );
  }

  opcoes?.onFase?.("compactando", 80);
  const blob = await res.blob();
  if (!blob.size) {
    throw new ErroJobCliente("Arquivo de backup vazio.", "falhou");
  }

  const tipo = (res.headers.get("Content-Type") || blob.type || "").toLowerCase();
  if (tipo.includes("application/json")) {
    throw new ErroJobCliente("Não foi possível gerar o backup.", "falhou");
  }

  const data = new Date().toISOString().slice(0, 10);
  const nomeArquivo =
    nomeArquivoDeContentDisposition(res.headers.get("Content-Disposition")) ||
    `backup-laboratorio-${data}.zip`;

  dispararDownloadBlob(blob, nomeArquivo);
  opcoes?.onFase?.("finalizado", 100);

  return {
    fase: "finalizado",
    percentual: 100,
    downloadUrl: "",
    nomeArquivo,
    exportedAt: new Date().toISOString(),
  };
}

/** Mantido para compatibilidade com fluxo por job (downloadUrl). */
export async function baixarBackupExportado(resultado: ResultadoBackupExportJob) {
  if (!resultado.downloadUrl) return;
  const res = await fetch(resultado.downloadUrl, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ErroJobCliente("Não foi possível baixar o arquivo de backup.", "rede");
  }
  const blob = await res.blob();
  if (!blob.size) {
    throw new ErroJobCliente("Arquivo de backup vazio.", "falhou");
  }
  dispararDownloadBlob(blob, resultado.nomeArquivo);
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
