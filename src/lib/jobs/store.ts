import { prisma } from "@/lib/db";
import type { JobRespostaPublica, StatusJob, TipoJob } from "@/lib/jobs/types";

type JobRow = {
  id: string;
  empresaId: string;
  tipo: string;
  status: string;
  progresso: number;
  payload: string;
  resultado: string | null;
  erro: string | null;
  criadoEm: Date;
  concluidoEm: Date | null;
};

function parseJson<T>(raw: string | null | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function serializarJobPublico(row: JobRow): JobRespostaPublica {
  return {
    jobId: row.id,
    tipo: row.tipo,
    status: row.status as StatusJob,
    progresso: row.progresso,
    resultado: parseJson(row.resultado),
    erro: row.erro,
    criadoEm: row.criadoEm.toISOString(),
    concluidoEm: row.concluidoEm?.toISOString() ?? null,
  };
}

export async function criarJob(empresaId: string, tipo: TipoJob, payload: unknown) {
  const job = await prisma.jobExecucao.create({
    data: {
      empresaId,
      tipo,
      status: "pendente",
      progresso: 0,
      payload: JSON.stringify(payload),
    },
  });
  return { ...job, status: job.status as StatusJob };
}

export async function obterJobTenant(empresaId: string, jobId: string) {
  return prisma.jobExecucao.findFirst({
    where: { id: jobId, empresaId },
  });
}

export async function atualizarJob(
  jobId: string,
  dados: Partial<{
    status: StatusJob;
    progresso: number;
    resultado: unknown;
    erro: string | null;
    concluidoEm: Date | null;
  }>
) {
  const update: {
    status?: string;
    progresso?: number;
    resultado?: string | null;
    erro?: string | null;
    concluidoEm?: Date | null;
  } = {};

  if (dados.status !== undefined) update.status = dados.status;
  if (dados.progresso !== undefined) update.progresso = dados.progresso;
  if (dados.resultado !== undefined) {
    update.resultado =
      dados.resultado === null || dados.resultado === undefined
        ? null
        : JSON.stringify(dados.resultado);
  }
  if (dados.erro !== undefined) update.erro = dados.erro;
  if (dados.concluidoEm !== undefined) update.concluidoEm = dados.concluidoEm;

  return prisma.jobExecucao.update({
    where: { id: jobId },
    data: update,
  });
}
