import { prisma } from "@/lib/db";
import { runWithTenantContext } from "@/lib/prisma-tenant";
import {
  CHATBOT_CONFIG_PADRAO,
  migrarConfigLegada,
  sanitizarOpcoesChatbot,
  type ChatbotConfigDados,
  type ChatbotOpcaoMenu,
} from "@/lib/whatsapp-chat/chatbot-config-types";

type RowConfig = {
  ativo: boolean;
  intro: string;
  rodapeMenu: string;
  opcao1Ativa: boolean;
  opcao1Texto: string;
  opcao2Ativa: boolean;
  opcao2Texto: string;
  opcao3Ativa: boolean;
  opcao3Texto: string;
  opcao4Ativa: boolean;
  opcao4Texto: string;
  msgAtendente: string;
  msgAguardandoOs: string;
  msgNaoEntendi: string;
  opcoes: unknown;
};

function parseOpcoesJson(valor: unknown, row: RowConfig): ChatbotOpcaoMenu[] {
  if (Array.isArray(valor) && valor.length > 0) {
    return sanitizarOpcoesChatbot(valor as ChatbotOpcaoMenu[]);
  }
  return migrarConfigLegada(row);
}

function rowParaConfig(row: RowConfig | null): ChatbotConfigDados {
  if (!row) return { ...CHATBOT_CONFIG_PADRAO, opcoes: [...CHATBOT_CONFIG_PADRAO.opcoes] };
  return {
    ativo: row.ativo,
    intro: row.intro,
    rodapeMenu: row.rodapeMenu,
    opcoes: parseOpcoesJson(row.opcoes, row),
    msgAtendente: row.msgAtendente,
    msgAguardandoOs: row.msgAguardandoOs,
    msgNaoEntendi: row.msgNaoEntendi,
  };
}

export async function obterChatbotConfig(empresaId: string): Promise<ChatbotConfigDados> {
  const row = await runWithTenantContext(empresaId, () =>
    prisma.whatsappChatbotConfig.findUnique({ where: { empresaId } })
  );
  return rowParaConfig(row);
}

export async function chatbotAtivoParaEmpresa(empresaId: string) {
  const config = await obterChatbotConfig(empresaId);
  return config.ativo;
}

export async function salvarChatbotConfig(empresaId: string, dados: ChatbotConfigDados) {
  const opcoes = sanitizarOpcoesChatbot(dados.opcoes);
  const row = await runWithTenantContext(empresaId, () =>
    prisma.whatsappChatbotConfig.upsert({
      where: { empresaId },
      create: {
        empresaId,
        ativo: dados.ativo,
        intro: dados.intro,
        rodapeMenu: dados.rodapeMenu,
        opcoes,
        msgAtendente: dados.msgAtendente,
        msgAguardandoOs: dados.msgAguardandoOs,
        msgNaoEntendi: dados.msgNaoEntendi,
        opcao1Ativa: opcoes[0]?.ativa ?? true,
        opcao1Texto: opcoes[0]?.texto ?? "",
        opcao2Ativa: opcoes[1]?.ativa ?? true,
        opcao2Texto: opcoes[1]?.texto ?? "",
        opcao3Ativa: opcoes[2]?.ativa ?? true,
        opcao3Texto: opcoes[2]?.texto ?? "",
        opcao4Ativa: opcoes[3]?.ativa ?? true,
        opcao4Texto: opcoes[3]?.texto ?? "",
      },
      update: {
        ativo: dados.ativo,
        intro: dados.intro,
        rodapeMenu: dados.rodapeMenu,
        opcoes,
        msgAtendente: dados.msgAtendente,
        msgAguardandoOs: dados.msgAguardandoOs,
        msgNaoEntendi: dados.msgNaoEntendi,
        opcao1Ativa: opcoes[0]?.ativa ?? false,
        opcao1Texto: opcoes[0]?.texto ?? "",
        opcao2Ativa: opcoes[1]?.ativa ?? false,
        opcao2Texto: opcoes[1]?.texto ?? "",
        opcao3Ativa: opcoes[2]?.ativa ?? false,
        opcao3Texto: opcoes[2]?.texto ?? "",
        opcao4Ativa: opcoes[3]?.ativa ?? false,
        opcao4Texto: opcoes[3]?.texto ?? "",
      },
    })
  );
  return rowParaConfig(row);
}
