import { prisma } from "@/lib/db";

export async function registrarLogMaster(
  masterId: string,
  acao: string,
  options?: { detalhes?: string; empresaId?: string; ip?: string }
) {
  await prisma.masterAuditLog.create({
    data: {
      masterId,
      acao,
      detalhes: options?.detalhes ?? null,
      empresaId: options?.empresaId ?? null,
      ip: options?.ip ?? null,
    },
  });
}

export function ipDaRequisicao(request: Request): string | undefined {
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]?.trim();
  return request.headers.get("x-real-ip") ?? undefined;
}
