import { baileysEnviarTexto } from "@/lib/whatsapp-disparos/baileys-service";
import {
  telefoneParaEnvioWhatsapp,
} from "@/lib/whatsapp-disparos/telefone-br";
import {
  mensagemEntradaJaProcessada,
  obterOuCriarConversaChat,
  registrarMensagemChat,
} from "@/lib/whatsapp-chat/conversa-store";
import {
  aplicarEstadoConversaAposResposta,
  processarTextoChatbot,
} from "@/lib/whatsapp-chat/motor";
import { chatbotWhatsappHabilitado } from "@/lib/whatsapp-chat/resolver-empresa";
import { chatbotAtivoParaEmpresa } from "@/lib/whatsapp-chat/chatbot-config-servidor";

export type PayloadMensagemRecebidaWhatsapp = {
  telefone?: string;
  mensagem: string;
  messageId?: string | null;
  jid?: string | null;
  numeroConectado?: string | null;
};

export type ResultadoProcessamentoChat = {
  ok: boolean;
  ignorado?: boolean;
  motivo?: string;
  respostasEnviadas?: number;
};

const ultimoEnvioPorTelefone = new Map<string, number>();
const INTERVALO_MINIMO_MS = 1200;

function aguardarIntervalo(telefone: string) {
  const agora = Date.now();
  const anterior = ultimoEnvioPorTelefone.get(telefone) || 0;
  const delta = agora - anterior;
  if (delta < INTERVALO_MINIMO_MS) {
    return new Promise((resolve) => setTimeout(resolve, INTERVALO_MINIMO_MS - delta));
  }
  return Promise.resolve();
}

function chaveTelefoneConversa(payload: PayloadMensagemRecebidaWhatsapp) {
  const jid = payload.jid?.trim() || "";
  if (jid.includes("@lid")) return jid;

  const direto = telefoneParaEnvioWhatsapp(payload.telefone || "");
  if (direto) return direto;
  if (jid.includes("@s.whatsapp.net")) {
    return telefoneParaEnvioWhatsapp(jid.split("@")[0]);
  }
  if (jid) return jid;
  return null;
}

export async function processarMensagemRecebidaWhatsapp(
  empresaId: string,
  payload: PayloadMensagemRecebidaWhatsapp
): Promise<ResultadoProcessamentoChat> {
  if (!chatbotWhatsappHabilitado()) {
    return { ok: true, ignorado: true, motivo: "chatbot_desabilitado" };
  }

  if (!(await chatbotAtivoParaEmpresa(empresaId))) {
    return { ok: true, ignorado: true, motivo: "chatbot_desabilitado_empresa" };
  }

  const telefone = chaveTelefoneConversa(payload);
  const mensagem = payload.mensagem?.trim() || "";
  const replyJid = payload.jid?.trim() || null;
  if ((!telefone && !replyJid) || !mensagem) {
    return { ok: true, ignorado: true, motivo: "entrada_invalida" };
  }

  if (payload.messageId && (await mensagemEntradaJaProcessada(payload.messageId))) {
    return { ok: true, ignorado: true, motivo: "duplicada" };
  }

  const conversa = await obterOuCriarConversaChat(empresaId, telefone || replyJid!);
  if (!conversa) {
    return { ok: false, motivo: "conversa_invalida" };
  }

  try {
    await registrarMensagemChat({
      conversaId: conversa.id,
      direcao: "entrada",
      texto: mensagem,
      messageId: payload.messageId,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICADA") {
      return { ok: true, ignorado: true, motivo: "duplicada" };
    }
    throw err;
  }

  const resultado = await processarTextoChatbot(empresaId, conversa, mensagem);

  if (resultado.respostas.length === 0) {
    await aplicarEstadoConversaAposResposta(conversa, resultado);
    return { ok: true, ignorado: true, motivo: "atendimento_humano", respostasEnviadas: 0 };
  }

  let enviadas = 0;
  for (const resposta of resultado.respostas) {
    const chaveIntervalo = telefone || replyJid || "";
    await aguardarIntervalo(chaveIntervalo);
    try {
      await baileysEnviarTexto(telefone || replyJid || "", resposta, { jid: replyJid });
      ultimoEnvioPorTelefone.set(chaveIntervalo, Date.now());
    } catch (err) {
      const mensagemErro = err instanceof Error ? err.message : "Falha ao enviar resposta";
      console.error("[whatsapp-chat] envio falhou", { telefone, replyJid, erro: mensagemErro });
      return {
        ok: false,
        motivo: mensagemErro,
        respostasEnviadas: enviadas,
      };
    }
    await registrarMensagemChat({
      conversaId: conversa.id,
      direcao: "saida",
      texto: resposta,
    });
    enviadas += 1;
  }

  await aplicarEstadoConversaAposResposta(conversa, resultado);
  return { ok: true, respostasEnviadas: enviadas };
}
