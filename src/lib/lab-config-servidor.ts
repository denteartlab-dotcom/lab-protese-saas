import {
  CONFIG_LAB_PADRAO,
  CONFIG_LAB_STORAGE_KEY,
  prepararConfigParaSalvar,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { normalizarConfigLaboratorio } from "@/lib/configuracoes-lab-parse";
import { garantirNomeLaboratorioParaImpressao } from "@/lib/lab-nome-exibicao";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import { prisma, runWithTenantContext } from "@/lib/db";
import { cache } from "react";

function configLaboratorioPadrao(): ConfigLaboratorio {
  return { ...CONFIG_LAB_PADRAO, tipoPessoa: "Jurídica" };
}

function emBuildProducaoNext() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * Leitura da config do laboratório (cache por request no RSC).
 * Sem empresaId: sempre padrão vazio — nunca lê o JsonStore global legado,
 * que vazava logo de outro laboratório para contas novas.
 */
export const carregarConfigLaboratorioServidor = cache(
  async function carregarConfigLaboratorioServidor(
    empresaId?: string
  ): Promise<ConfigLaboratorio> {
  if (emBuildProducaoNext()) {
    return configLaboratorioPadrao();
  }

  if (!empresaId?.trim()) {
    return configLaboratorioPadrao();
  }

  try {
    // Garante tenant no Postgres (lab_app + RLS) mesmo quando o chamador esqueceu.
    const [parsed, empresa] = await runWithTenantContext(empresaId, () =>
      Promise.all([
        lerJsonStoreTenant<Partial<ConfigLaboratorio>>(empresaId, CONFIG_LAB_STORAGE_KEY),
        prisma.empresa.findUnique({
          where: { id: empresaId },
          select: { nome: true },
        }),
      ])
    );
    if (parsed) {
      const config = normalizarConfigLaboratorio(parsed);
      return prepararConfigParaSalvar(
        garantirNomeLaboratorioParaImpressao({
          ...config,
          logoDataUrl: config.logoDataUrl?.trim() || "",
        })
      );
    }
    if (empresa?.nome?.trim()) {
      return garantirNomeLaboratorioParaImpressao({
        ...configLaboratorioPadrao(),
        nomeLaboratorio: empresa.nome.trim(),
        logoDataUrl: "",
      });
    }
    return configLaboratorioPadrao();
  } catch (err) {
    console.warn(
      "[lab-config] usando padrão (banco indisponível):",
      err instanceof Error ? err.message : err
    );
    return configLaboratorioPadrao();
  }
  }
);
