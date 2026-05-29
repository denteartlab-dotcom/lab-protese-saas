import {
  CONFIG_LAB_PADRAO,
  CONFIG_LAB_STORAGE_KEY,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { normalizarConfigLaboratorio } from "@/lib/configuracoes-lab-parse";
import { prisma } from "@/lib/db";

export async function carregarConfigLaboratorioServidor(): Promise<ConfigLaboratorio> {
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
