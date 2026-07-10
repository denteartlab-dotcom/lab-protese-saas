import { baileysEnviarMidia, baileysEnviarTexto } from "@/lib/whatsapp-disparos/baileys-service";
import { formatWhatsAppPhone } from "@/lib/whatsapp";
import { metaEnviarMidia, metaEnviarTexto } from "@/lib/whatsapp-cloud/meta-enviar";
import { provedorChatbotWhatsapp } from "@/lib/whatsapp-cloud/meta-config";

type OpcoesEnvioChatbot = {
  jid?: string | null;
  phoneNumberId?: string | null;
};

export async function enviarTextoChatbot(
  destino: string,
  mensagem: string,
  opts?: OpcoesEnvioChatbot
) {
  const provedor = provedorChatbotWhatsapp();

  if (provedor === "dev") {
    console.info(`[whatsapp-chat-dev] Para ${formatWhatsAppPhone(destino)}: ${mensagem}`);
    return;
  }

  if (provedor === "cloud") {
    const resultado = await metaEnviarTexto(destino, mensagem, {
      phoneNumberId: opts?.phoneNumberId,
    });
    if (!resultado.ok) throw new Error(resultado.error);
    return;
  }

  await baileysEnviarTexto(destino, mensagem, { jid: opts?.jid });
}

export async function enviarMidiaChatbot(
  destino: string,
  opts: {
    mensagem?: string;
    mimeType: string;
    fileName: string;
    dataBase64: string;
    tipo: "imagem" | "pdf" | "documento" | "video" | "audio";
    jid?: string | null;
    phoneNumberId?: string | null;
  }
) {
  const provedor = provedorChatbotWhatsapp();

  if (provedor === "dev") {
    console.info(`[whatsapp-chat-dev] Mídia para ${formatWhatsAppPhone(destino)}: ${opts.fileName}`);
    return;
  }

  if (provedor === "cloud") {
    const resultado = await metaEnviarMidia(destino, {
      mensagem: opts.mensagem,
      mimeType: opts.mimeType,
      fileName: opts.fileName,
      dataBase64: opts.dataBase64,
      tipo: opts.tipo,
      phoneNumberId: opts.phoneNumberId,
    });
    if (!resultado.ok) throw new Error(resultado.error);
    return;
  }

  await baileysEnviarMidia(destino, {
    mensagem: opts.mensagem,
    mimeType: opts.mimeType,
    fileName: opts.fileName,
    dataBase64: opts.dataBase64,
    tipo: opts.tipo,
    jid: opts.jid,
  });
}
