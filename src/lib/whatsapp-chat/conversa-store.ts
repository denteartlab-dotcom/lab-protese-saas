import { prisma } from "@/lib/db";
import { runWithTenantContext } from "@/lib/prisma-tenant";
import { normalizarTelefoneBr } from "@/lib/whatsapp-disparos/telefone-br";

export type EtapaChatWhatsapp = "menu" | "aguardando_os" | "atendente";

export type ConversaChatWhatsapp = {
  id: string;
  empresaId: string;
  telefone: string;
  etapa: EtapaChatWhatsapp;
  clienteId: string | null;
  atendimentoHumano: boolean;
};

export async function obterOuCriarConversaChat(
  empresaId: string,
  telefoneRaw: string
): Promise<ConversaChatWhatsapp | null> {
  const telefone = normalizarTelefoneBr(telefoneRaw);
  if (!telefone) return null;

  const row = await runWithTenantContext(empresaId, () =>
    prisma.whatsappChatConversa.upsert({
      where: { empresaId_telefone: { empresaId, telefone } },
      create: { empresaId, telefone, etapa: "menu" },
      update: { ultimaMensagemEm: new Date() },
    })
  );

  return {
    id: row.id,
    empresaId: row.empresaId,
    telefone: row.telefone,
    etapa: (row.etapa as EtapaChatWhatsapp) || "menu",
    clienteId: row.clienteId,
    atendimentoHumano: row.atendimentoHumano,
  };
}

export async function atualizarConversaChat(
  conversaId: string,
  empresaId: string,
  patch: Partial<{
    etapa: EtapaChatWhatsapp;
    clienteId: string | null;
    atendimentoHumano: boolean;
  }>
) {
  await runWithTenantContext(empresaId, () =>
    prisma.whatsappChatConversa.update({
      where: { id: conversaId },
      data: {
        ...(patch.etapa !== undefined ? { etapa: patch.etapa } : {}),
        ...(patch.clienteId !== undefined ? { clienteId: patch.clienteId } : {}),
        ...(patch.atendimentoHumano !== undefined
          ? { atendimentoHumano: patch.atendimentoHumano }
          : {}),
        ultimaMensagemEm: new Date(),
      },
    })
  );
}

export async function mensagemEntradaJaProcessada(messageId: string) {
  if (!messageId.trim()) return false;
  const existente = await prisma.whatsappChatMensagem.findUnique({
    where: { messageId },
    select: { id: true },
  });
  return Boolean(existente);
}

export async function registrarMensagemChat(opts: {
  conversaId: string;
  direcao: "entrada" | "saida";
  texto: string;
  messageId?: string | null;
}) {
  await prisma.whatsappChatMensagem.create({
    data: {
      conversaId: opts.conversaId,
      direcao: opts.direcao,
      texto: opts.texto,
      messageId: opts.messageId?.trim() || null,
    },
  });
}
