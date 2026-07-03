import type { JobRespostaPublica, StatusJob } from "@/lib/jobs/types";

export class ErroJobCliente extends Error {
  constructor(
    message: string,
    readonly codigo: "nao_encontrado" | "falhou" | "timeout" | "abortado" | "rede"
  ) {
    super(message);
    this.name = "ErroJobCliente";
  }
}

export type OpcoesPollingJobCliente = {
  intervaloMs?: number;
  timeoutMs?: number;
  onProgresso?: (progresso: number, status: StatusJob) => void;
  onJob?: (job: JobRespostaPublica) => void;
  signal?: AbortSignal;
};

/** Consulta GET /api/jobs/[id] até concluir ou falhar (issue 012). */
export async function aguardarJobCliente(
  jobId: string,
  opcoes?: OpcoesPollingJobCliente
): Promise<JobRespostaPublica> {
  const intervaloMs = opcoes?.intervaloMs ?? 400;
  const timeoutMs = opcoes?.timeoutMs ?? 120_000;
  const inicio = Date.now();

  while (Date.now() - inicio < timeoutMs) {
    if (opcoes?.signal?.aborted) {
      throw new ErroJobCliente("Importação cancelada.", "abortado");
    }

    let res: Response;
    try {
      res = await fetch(`/api/jobs/${jobId}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: opcoes?.signal,
      });
    } catch {
      throw new ErroJobCliente("Erro de conexão ao acompanhar a importação.", "rede");
    }

    if (res.status === 404) {
      throw new ErroJobCliente("Job não encontrado.", "nao_encontrado");
    }
    if (!res.ok) {
      throw new ErroJobCliente("Não foi possível consultar o status da importação.", "rede");
    }

    const job = (await res.json()) as JobRespostaPublica;
    opcoes?.onProgresso?.(job.progresso, job.status);
    opcoes?.onJob?.(job);

    if (job.status === "concluido") return job;
    if (job.status === "falhou") {
      throw new ErroJobCliente(job.erro || "Falha ao importar.", "falhou");
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervaloMs));
  }

  throw new ErroJobCliente("A importação demorou demais. Tente novamente.", "timeout");
}
