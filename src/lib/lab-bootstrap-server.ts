import { asaasConfigurado } from "@/lib/asaas-config";
import { obterConfigAsaas } from "@/lib/asaas-client";
import { obterSubcontaEmpresa, serializarSubcontaPublica } from "@/lib/asaas-subconta";
import {
  CONFIG_GERAIS_STORAGE_KEY,
  normalizarConfiguracoesGerais,
  type ConfiguracoesGerais,
} from "@/lib/configuracoes-gerais";
import { nomeExibicaoLaboratorio } from "@/lib/configuracoes-lab";
import { configParaLabImpressao } from "@/lib/lab-logo";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import { carregarConfigNfse } from "@/lib/nfse/servico";
import { nfseConfigurada } from "@/lib/nfse-config";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import { runWithTenantContext } from "@/lib/db";

import type { LabBootstrapPayload } from "@/lib/lab-bootstrap-types";

export type { LabBootstrapIntegracoes, LabBootstrapPayload } from "@/lib/lab-bootstrap-types";

export async function montarLabBootstrap(empresaId: string): Promise<LabBootstrapPayload> {
  return runWithTenantContext(empresaId, async () => {
    const [configLab, geraisRaw, asaas, nfse, subconta] = await Promise.all([
      carregarConfigLaboratorioServidor(empresaId),
      lerJsonStoreTenant<Partial<ConfiguracoesGerais>>(empresaId, CONFIG_GERAIS_STORAGE_KEY),
      obterConfigAsaas(empresaId),
      carregarConfigNfse(empresaId),
      obterSubcontaEmpresa(empresaId),
    ]);

    const lab = configParaLabImpressao(configLab);
    const nomeLaboratorio = nomeExibicaoLaboratorio(configLab);

    return {
      lab: {
        ...lab,
        nomeLaboratorio,
      },
      configuracoesGerais: normalizarConfiguracoesGerais(geraisRaw),
      integracoes: {
        asaas: {
          configurado: asaasConfigurado(asaas),
          ambiente: asaas.ambiente,
          apiKeyConfigurada: Boolean(asaas.apiKey?.trim()),
          webhookTokenConfigurado: Boolean(asaas.webhookToken?.trim()),
          subconta: serializarSubcontaPublica(subconta),
        },
        nfse: {
          configurado: nfseConfigurada(nfse),
          provedor: nfse.provedor,
          ambiente: nfse.ambiente,
          credenciaisConfiguradas: nfseConfigurada(nfse),
        },
      },
    };
  });
}
