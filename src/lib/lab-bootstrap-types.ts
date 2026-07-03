import type { ConfiguracoesGerais } from "@/lib/configuracoes-gerais";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";

export type LabBootstrapIntegracoes = {
  asaas: {
    configurado: boolean;
    ambiente: string;
    apiKeyConfigurada: boolean;
    webhookTokenConfigurado: boolean;
    subconta: {
      status: string;
      statusGeral?: string | null;
      statusDocumentacao?: string | null;
      asaasAccountId?: string | null;
      walletId?: string | null;
      agencia?: string | null;
      conta?: string | null;
      contaDigito?: string | null;
      contaAtiva?: boolean;
      contaMaeConfigurada?: boolean;
    };
  };
  nfse: {
    configurado: boolean;
    provedor: string;
    ambiente: string;
    credenciaisConfiguradas: boolean;
  };
};

export type LabBootstrapPayload = {
  lab: LabImpressaoConfig & { nomeLaboratorio: string };
  configuracoesGerais: ConfiguracoesGerais;
  integracoes: LabBootstrapIntegracoes;
};
