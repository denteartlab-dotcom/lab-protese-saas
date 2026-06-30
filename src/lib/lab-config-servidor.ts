import {
  CONFIG_LAB_PADRAO,
  CONFIG_LAB_STORAGE_KEY,
  prepararConfigParaSalvar,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { normalizarConfigLaboratorio } from "@/lib/configuracoes-lab-parse";
import { garantirNomeLaboratorioParaImpressao } from "@/lib/lab-nome-exibicao";
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
      const [parsed, empresa] = await Promise.all([
        lerJsonStoreTenant<Partial<ConfigLaboratorio>>(empresaId, CONFIG_LAB_STORAGE_KEY),
        prisma.empresa.findUnique({
          where: { id: empresaId },
          select: { nome: true },
        }),
      ]);
      if (parsed) {
        const config = normalizarConfigLaboratorio(parsed);
        return prepararConfigParaSalvar(garantirNomeLaboratorioParaImpressao(config));
      }
      if (empresa?.nome?.trim()) {
        return garantirNomeLaboratorioParaImpressao({
          ...configLaboratorioPadrao(),
          nomeLaboratorio: empresa.nome.trim(),
        });
      }
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
      return prepararConfigParaSalvar(normalizarConfigLaboratorio(parsed));
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
