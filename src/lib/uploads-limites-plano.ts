import { executarSemRls } from "@/lib/db";
import {
  limiteGaleriaBytes,
  limiteGaleriaGb,
} from "@/lib/uploads-armazenamento";

const MARCA_TESTE_GRATIS = /teste\s*gr[aá]tis/i;

export function observacoesIndicamTesteGratis(
  observacoes: string | null | undefined
): boolean {
  return MARCA_TESTE_GRATIS.test(observacoes || "");
}

/**
 * Teste grátis = nunca pagou assinatura e ainda carrega a marca de trial.
 * Assinante (pago ou ativado pelo admin sem marca de trial) = 25 GB.
 */
export async function resolverLimiteArmazenamentoEmpresa(empresaId?: string): Promise<{
  emTesteGratis: boolean;
  limiteGb: number;
  limiteBytes: number;
}> {
  if (!empresaId) {
    return {
      emTesteGratis: false,
      limiteGb: limiteGaleriaGb(false),
      limiteBytes: limiteGaleriaBytes(false),
    };
  }

  const empresa = await executarSemRls((tx) =>
    tx.empresa.findUnique({
      where: { id: empresaId },
      select: {
        observacoes: true,
        cobrancasAssinatura: {
          where: { pagoEm: { not: null } },
          select: { id: true },
          take: 1,
        },
      },
    })
  );

  const jaPagou = (empresa?.cobrancasAssinatura.length ?? 0) > 0;
  const emTesteGratis =
    !jaPagou && observacoesIndicamTesteGratis(empresa?.observacoes);

  return {
    emTesteGratis,
    limiteGb: limiteGaleriaGb(emTesteGratis),
    limiteBytes: limiteGaleriaBytes(emTesteGratis),
  };
}

/** Remove a marca de teste grátis das observações (após pagamento/ativação). */
export function limparMarcaTesteGratisObservacoes(
  observacoes: string | null | undefined
): string | null {
  if (!observacoes?.trim()) return null;
  const linhas = observacoes
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !MARCA_TESTE_GRATIS.test(l));
  const texto = linhas.join("\n").trim();
  return texto || null;
}
