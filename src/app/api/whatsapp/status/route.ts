import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import { consultarStatusBaileys } from "@/lib/whatsapp-baileys-status";
import {
  whatsappAutomacaoServidorHabilitada,
  whatsappBaileysConfigurado,
  whatsappCloudConfigurado,
} from "@/lib/whatsapp-enviar";
import { provedorChatbotWhatsapp } from "@/lib/whatsapp-cloud/meta-config";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(ctx, "disparos-whatsapp", "ver");
  if (negado) return negado;

  const habilitado = whatsappAutomacaoServidorHabilitada();
  const baileys = whatsappBaileysConfigurado();
  const cloud = whatsappCloudConfigurado();
  const provedorChatbot = provedorChatbotWhatsapp();

  if (!habilitado && !cloud) {
    return NextResponse.json({
      habilitado: false,
      conectado: false,
      baileys: false,
      cloud: false,
      qr: null,
    });
  }

  if (provedorChatbot === "cloud" && cloud) {
    return NextResponse.json({
      habilitado: true,
      conectado: true,
      baileys: baileys,
      cloud: true,
      qr: null,
      modo: "meta",
      provedorChatbot: "cloud",
    });
  }

  if (!baileys) {
    return NextResponse.json({
      habilitado: true,
      conectado: cloud,
      baileys: false,
      cloud,
      qr: null,
      modo: cloud ? "meta" : "dev",
      provedorChatbot,
    });
  }

  const status = await consultarStatusBaileys();
  return NextResponse.json({
    habilitado: true,
    baileys: true,
    cloud,
    conectado: Boolean(status?.connected),
    qr: status?.qr || null,
    modo: "baileys",
    provedorChatbot,
  });
}
