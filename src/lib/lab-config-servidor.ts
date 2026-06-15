import {
  CONFIG_LAB_PADRAO,
  CONFIG_LAB_STORAGE_KEY,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { normalizarConfigLaboratorio } from "@/lib/configuracoes-lab-parse";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import { prisma } from "@/lib/db";

/** Leitura da config do laboratório (sem React cache — compatível com server.ts + tsx). */
export async function carregarConfigLaboratorioServidor(
  empresaId?: string
): Promise<ConfigLaboratorio> {
  if (empresaId) {
    const parsed = await lerJsonStoreTenant<Partial<ConfigLaboratorio>>(
      empresaId,
      CONFIG_LAB_STORAGE_KEY
    );
    if (parsed) return normalizarConfigLaboratorio(parsed);
    return { ...CONFIG_LAB_PADRAO, tipoPessoa: "Jurídica" };
  }

  const row = await prisma.jsonStore.findUnique({
    where: { key: CONFIG_LAB_STORAGE_KEY },
  });
  if (!row?.payload) {
    return { ...CONFIG_LAB_PADRAO, tipoPessoa: "Jurídica" };
  }
  try {
    const parsed = JSON.parse(row.payload) as Partial<ConfigLaboratorio>;
    return normalizarConfigLaboratorio(parsed);
  } catch {
    return { ...CONFIG_LAB_PADRAO, tipoPessoa: "Jurídica" };
  }
}
