import { prisma, runWithTenantContext } from "@/lib/db";

const INTERVALO_MINIMO_MS = 6 * 60 * 60 * 1000;

/** Atualiza último acesso (no máximo a cada 6 h por empresa). */
export async function registrarUltimoAcessoEmpresa(empresaId: string) {
  return runWithTenantContext(empresaId, async () => {
    const agora = new Date();
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { ultimoAcessoEm: true },
    });
    if (!empresa) return;

    const ultimo = empresa.ultimoAcessoEm;
    if (ultimo && agora.getTime() - ultimo.getTime() < INTERVALO_MINIMO_MS) {
      return;
    }

    await prisma.empresa.update({
      where: { id: empresaId },
      data: { ultimoAcessoEm: agora },
    });
  });
}

/** Sempre grava acesso (ex.: login). */
export async function registrarUltimoAcessoEmpresaImediato(empresaId: string) {
  return runWithTenantContext(empresaId, () =>
    prisma.empresa.update({
      where: { id: empresaId },
      data: { ultimoAcessoEm: new Date() },
    })
  );
}
