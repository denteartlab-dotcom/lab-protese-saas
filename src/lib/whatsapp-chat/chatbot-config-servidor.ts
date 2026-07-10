import { prisma } from "@/lib/db";
import { runWithTenantContext } from "@/lib/prisma-tenant";
import {
  CHATBOT_CONFIG_PADRAO,
  type ChatbotConfigDados,
} from "@/lib/whatsapp-chat/chatbot-config-types";

function rowParaConfig(
  row: {
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
  } | null
): ChatbotConfigDados {
  if (!row) return { ...CHATBOT_CONFIG_PADRAO };
  return {
    ativo: row.ativo,
    intro: row.intro,
    rodapeMenu: row.rodapeMenu,
    opcao1Ativa: row.opcao1Ativa,
    opcao1Texto: row.opcao1Texto,
    opcao2Ativa: row.opcao2Ativa,
    opcao2Texto: row.opcao2Texto,
    opcao3Ativa: row.opcao3Ativa,
    opcao3Texto: row.opcao3Texto,
    opcao4Ativa: row.opcao4Ativa,
    opcao4Texto: row.opcao4Texto,
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
  const row = await runWithTenantContext(empresaId, () =>
    prisma.whatsappChatbotConfig.upsert({
      where: { empresaId },
      create: { empresaId, ...dados },
      update: { ...dados },
    })
  );
  return rowParaConfig(row);
}
