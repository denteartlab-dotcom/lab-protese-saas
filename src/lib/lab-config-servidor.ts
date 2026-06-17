import {
  CONFIG_LAB_PADRAO,
  CONFIG_LAB_STORAGE_KEY,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { normalizarConfigLaboratorio } from "@/lib/configuracoes-lab-parse";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import { prisma } from "@/lib/db";
import { cache } from "react";

function configLaboratorioPadrao(): ConfigLaboratorio {
  return { ...CONFIG_LAB_PADRAO, tipoPessoa: "Jurídica" };
}

function emBuildProducaoNext() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** Leitura da config do laboratório (cache por request no RSC). */
export const carregarConfigLaboratorioServidor = cache(
  async function carregarConfigLaboratorioServidor(
    empresaId?: string
  ): Promise<ConfigLaboratorio> {
  if (emBuildProducaoNext()) {
    return configLaboratorioPadrao();
  }

  try {
    if (empresaId) {
      const parsed = await lerJsonStoreTenant<Partial<ConfigLaboratorio>>(
        empresaId,
        CONFIG_LAB_STORAGE_KEY
      );
      if (parsed) return normalizarConfigLaboratorio(parsed);
      return configLaboratorioPadrao();
    }

    const row = await prisma.jsonStore.findUnique({
      where: { key: CONFIG_LAB_STORAGE_KEY },
    });
    if (!row?.payload) {
      return configLaboratorioPadrao();
    }
    try {
      const parsed = JSON.parse(row.payload) as Partial<ConfigLaboratorio>;
      return normalizarConfigLaboratorio(parsed);
    } catch {
      return configLaboratorioPadrao();
    }
  } catch (err) {
    console.warn(
      "[lab-config] usando padrão (banco indisponível):",
      err instanceof Error ? err.message : err
    );
    return configLaboratorioPadrao();
  }
  }
);
