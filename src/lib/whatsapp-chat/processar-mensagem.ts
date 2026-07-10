import { baileysEnviarTexto } from "@/lib/whatsapp-disparos/baileys-service";
import { normalizarTelefoneBr } from "@/lib/whatsapp-disparos/telefone-br";
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

export type PayloadMensagemRecebidaWhatsapp = {
  telefone: string;
  mensagem: string;
  messageId?: string | null;
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

export async function processarMensagemRecebidaWhatsapp(
  empresaId: string,
  payload: PayloadMensagemRecebidaWhatsapp
): Promise<ResultadoProcessamentoChat> {
  if (!chatbotWhatsappHabilitado()) {
    return { ok: true, ignorado: true, motivo: "chatbot_desabilitado" };
  }

  const telefone = normalizarTelefoneBr(payload.telefone);
  const mensagem = payload.mensagem?.trim() || "";
  if (!telefone || !mensagem) {
    return { ok: true, ignorado: true, motivo: "entrada_invalida" };
  }

  if (payload.messageId && (await mensagemEntradaJaProcessada(payload.messageId))) {
    return { ok: true, ignorado: true, motivo: "duplicada" };
  }

  const conversa = await obterOuCriarConversaChat(empresaId, telefone);
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
    await aguardarIntervalo(telefone);
    try {
      await baileysEnviarTexto(telefone, resposta);
      ultimoEnvioPorTelefone.set(telefone, Date.now());
    } catch (err) {
      const mensagemErro = err instanceof Error ? err.message : "Falha ao enviar resposta";
      console.error("[whatsapp-chat]", mensagemErro);
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
