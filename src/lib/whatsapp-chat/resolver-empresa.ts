import { prisma } from "@/lib/db";
import { formatWhatsAppPhone } from "@/lib/whatsapp";
import { telefonesBrCoincidem } from "@/lib/whatsapp-disparos/telefone-br";
import { sincronizarSessaoWhatsapp } from "@/lib/whatsapp-disparos/campanha-servidor";

export function chatbotWhatsappHabilitado() {
  return process.env.WHATSAPP_CHATBOT_ENABLED !== "false";
}

/**
 * Resolve o laboratório (tenant) para mensagens recebidas sem sessão de usuário.
 * Só retorna quando a empresa é única ou identificável pelo número — sem fallback
 * ambíguo (sessoes[0] / empresas[0]), que misturaria tenants sob owner/bypass.
 */
export async function resolverEmpresaIdWebhook(opts?: {
  numeroConectado?: string | null;
  phoneNumberId?: string | null;
}): Promise<string | null> {
  const fixo = process.env.WHATSAPP_EMPRESA_ID?.trim();
  if (fixo) return fixo;

  const sessoes = await prisma.whatsappSession.findMany({
    where: { status: "conectado" },
    select: { empresaId: true, numeroConectado: true },
  });

  if (sessoes.length === 1) return sessoes[0].empresaId;

  if (sessoes.length > 1) {
    const conectado = opts?.numeroConectado?.trim();
    if (conectado) {
      const alvo = formatWhatsAppPhone(conectado);
      const porNumero = sessoes.find((s) =>
        s.numeroConectado ? telefonesBrCoincidem(s.numeroConectado, alvo) : false
      );
      if (porNumero) return porNumero.empresaId;
    }
    return null;
  }

  const empresasAtivas = await prisma.empresa.findMany({
    where: { status: "ativo" },
    select: { id: true },
    take: 2,
  });
  if (empresasAtivas.length === 1) return empresasAtivas[0].id;

  return null;
}

/** Mantém WhatsappSession como conectada quando o Baileys envia o número ativo. */
export async function sincronizarSessaoWebhook(
  empresaId: string,
  numeroConectado?: string | null
) {
  if (!numeroConectado?.trim()) return;
  await sincronizarSessaoWhatsapp(empresaId, {
    conectado: true,
    numero: numeroConectado,
  });
}
