import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { consultarStatusBaileys } from "@/lib/whatsapp-baileys-status";
import {
  whatsappAutomacaoServidorHabilitada,
  whatsappBaileysConfigurado,
} from "@/lib/whatsapp-enviar";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const habilitado = whatsappAutomacaoServidorHabilitada();
  const baileys = whatsappBaileysConfigurado();

  if (!habilitado) {
    return NextResponse.json({
      habilitado: false,
      conectado: false,
      baileys: false,
      qr: null,
    });
  }

  if (!baileys) {
    return NextResponse.json({
      habilitado: true,
      conectado: true,
      baileys: false,
      qr: null,
      modo: "meta",
    });
  }

  const status = await consultarStatusBaileys();
  return NextResponse.json({
    habilitado: true,
    baileys: true,
    conectado: Boolean(status?.connected),
    qr: status?.qr || null,
    modo: "baileys",
  });
}
