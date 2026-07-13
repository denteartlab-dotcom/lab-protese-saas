import { NextResponse } from "next/server";
import { z } from "zod";
import { processarMensagemRecebidaWhatsapp } from "@/lib/whatsapp-chat/processar-mensagem";
import {
  chatbotWhatsappHabilitado,
  resolverEmpresaIdWebhook,
  sincronizarSessaoWebhook,
} from "@/lib/whatsapp-chat/resolver-empresa";
import {
  provedorChatbotWhatsapp,
  whatsappCloudConfigurado,
} from "@/lib/whatsapp-cloud/meta-config";
import {
  ehPayloadMetaCloud,
  extrairMensagensMetaCloud,
  verificarAssinaturaMeta,
  verificarWebhookMeta,
} from "@/lib/whatsapp-cloud/meta-webhook";
import { webhookAceitaSemSegredo } from "@/lib/webhook-seguranca";

export const dynamic = "force-dynamic";

const schemaBaileys = z
  .object({
    telefone: z.string().min(8).optional(),
    mensagem: z.string().min(1).max(4000),
    messageId: z.string().optional().nullable(),
    jid: z.string().optional().nullable(),
    numeroConectado: z.string().optional().nullable(),
  })
  .refine((data) => Boolean(data.telefone?.trim() || data.jid?.trim()), {
    message: "Informe telefone ou jid",
  });

function autorizadoWebhookBaileys(request: Request) {
  const tokenEsperado = process.env.WHATSAPP_HTTP_TOKEN?.trim();
  if (!tokenEsperado) return webhookAceitaSemSegredo();

  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${tokenEsperado}`) return true;

  const header = request.headers.get("x-whatsapp-token") || "";
  return header === tokenEsperado;
}

/** Ping ou verificação da Meta (hub.challenge). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challenge = verificarWebhookMeta(searchParams);
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({
    ok: true,
    webhook: "whatsapp-chat",
    chatbotHabilitado: chatbotWhatsappHabilitado(),
    provedorChatbot: provedorChatbotWhatsapp(),
    cloudApi: whatsappCloudConfigurado(),
    tokenObrigatorio: Boolean(process.env.WHATSAPP_HTTP_TOKEN?.trim()),
  });
}

export async function POST(request: Request) {
  if (!chatbotWhatsappHabilitado()) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: "chatbot_desabilitado" });
  }

  const rawBody = await request.text();
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (ehPayloadMetaCloud(body)) {
    if (!whatsappCloudConfigurado()) {
      return NextResponse.json(
        { ok: false, error: "Cloud API não configurada" },
        { status: 422 }
      );
    }

    const assinatura = request.headers.get("x-hub-signature-256");
    if (!verificarAssinaturaMeta(rawBody, assinatura)) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }

    const mensagens = extrairMensagensMetaCloud(body);
    if (mensagens.length === 0) {
      return NextResponse.json({ ok: true, ignorado: true, motivo: "sem_mensagens" });
    }

    const resultados = [];
    for (const item of mensagens) {
      const empresaId = await resolverEmpresaIdWebhook({
        numeroConectado: item.displayPhoneNumber || item.phoneNumberId,
        phoneNumberId: item.phoneNumberId,
      });
      if (!empresaId) {
        resultados.push({ ok: false, error: "empresa_nao_identificada" });
        continue;
      }

      await sincronizarSessaoWebhook(empresaId, item.displayPhoneNumber);

      const resultado = await processarMensagemRecebidaWhatsapp(empresaId, {
        ...item.payload,
        phoneNumberId: item.phoneNumberId,
      });
      resultados.push(resultado);
    }

    return NextResponse.json({ ok: true, resultados });
  }

  if (!autorizadoWebhookBaileys(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const data = schemaBaileys.parse(body);

    const empresaId = await resolverEmpresaIdWebhook({
      numeroConectado: data.numeroConectado,
    });
    if (!empresaId) {
      return NextResponse.json(
        { ok: false, error: "Laboratório não identificado para o webhook." },
        { status: 422 }
      );
    }

    await sincronizarSessaoWebhook(empresaId, data.numeroConectado);

    const resultado = await processarMensagemRecebidaWhatsapp(empresaId, data);
    return NextResponse.json(resultado);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    console.error("[api/whatsapp/webhook]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
