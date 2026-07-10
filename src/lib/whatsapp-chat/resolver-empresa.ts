import { prisma } from "@/lib/db";
import { formatWhatsAppPhone } from "@/lib/whatsapp";
import { telefonesBrCoincidem } from "@/lib/whatsapp-disparos/telefone-br";

export function chatbotWhatsappHabilitado() {
  return process.env.WHATSAPP_CHATBOT_ENABLED !== "false";
}

/** Resolve o laboratório (tenant) para mensagens recebidas sem sessão de usuário. */
export async function resolverEmpresaIdWebhook(opts?: {
  numeroConectado?: string | null;
}): Promise<string | null> {
  const fixo = process.env.WHATSAPP_EMPRESA_ID?.trim();
  if (fixo) return fixo;

  const sessoes = await prisma.whatsappSession.findMany({
    where: { status: "conectado" },
    select: { empresaId: true, numeroConectado: true },
  });

  if (sessoes.length === 0) return null;
  if (sessoes.length === 1) return sessoes[0].empresaId;

  const conectado = opts?.numeroConectado?.trim();
  if (conectado) {
    const alvo = formatWhatsAppPhone(conectado);
    const porNumero = sessoes.find((s) =>
      s.numeroConectado ? telefonesBrCoincidem(s.numeroConectado, alvo) : false
    );
    if (porNumero) return porNumero.empresaId;
  }

  return sessoes[0]?.empresaId ?? null;
}
