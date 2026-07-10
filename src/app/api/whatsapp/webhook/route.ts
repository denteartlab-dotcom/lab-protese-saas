import { NextResponse } from "next/server";
import { z } from "zod";
import { processarMensagemRecebidaWhatsapp } from "@/lib/whatsapp-chat/processar-mensagem";
import {
  chatbotWhatsappHabilitado,
  resolverEmpresaIdWebhook,
  sincronizarSessaoWebhook,
} from "@/lib/whatsapp-chat/resolver-empresa";

export const dynamic = "force-dynamic";

const schema = z.object({
  telefone: z.string().min(8),
  mensagem: z.string().min(1).max(4000),
  messageId: z.string().optional().nullable(),
  jid: z.string().optional().nullable(),
  numeroConectado: z.string().optional().nullable(),
});

function autorizadoWebhook(request: Request) {
  const tokenEsperado = process.env.WHATSAPP_HTTP_TOKEN?.trim();
  if (!tokenEsperado) return true;

  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${tokenEsperado}`) return true;

  const header = request.headers.get("x-whatsapp-token") || "";
  return header === tokenEsperado;
}

export async function POST(request: Request) {
  if (!chatbotWhatsappHabilitado()) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: "chatbot_desabilitado" });
  }

  if (!autorizadoWebhook(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = schema.parse(body);

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
