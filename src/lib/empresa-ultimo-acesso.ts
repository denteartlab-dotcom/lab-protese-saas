import { executarSemRls } from "@/lib/db";

const INTERVALO_MINIMO_MS = 6 * 60 * 60 * 1000;

/** Atualiza último acesso (no máximo a cada 6 h por empresa). Cancela aviso de inatividade. */
export async function registrarUltimoAcessoEmpresa(empresaId: string) {
  return executarSemRls(async (tx) => {
    const agora = new Date();
    const empresa = await tx.empresa.findUnique({
      where: { id: empresaId },
      select: { ultimoAcessoEm: true, avisoInatividadeEnviadoEm: true },
    });
    if (!empresa) return;

    const ultimo = empresa.ultimoAcessoEm;
    if (
      ultimo &&
      agora.getTime() - ultimo.getTime() < INTERVALO_MINIMO_MS &&
      !empresa.avisoInatividadeEnviadoEm
    ) {
      return;
    }

    await tx.empresa.update({
      where: { id: empresaId },
      data: {
        ultimoAcessoEm: agora,
        avisoInatividadeEnviadoEm: null,
      },
    });
  });
}

/** Sempre grava acesso (ex.: login) e cancela aviso de exclusão por inatividade. */
export async function registrarUltimoAcessoEmpresaImediato(empresaId: string) {
  return executarSemRls((tx) =>
    tx.empresa.update({
      where: { id: empresaId },
      data: {
        ultimoAcessoEm: new Date(),
        avisoInatividadeEnviadoEm: null,
      },
    })
  );
}
