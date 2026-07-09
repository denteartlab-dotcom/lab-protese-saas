import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { iniciarFilaCampanha } from "@/lib/whatsapp-disparos/campaign-queue";
import { obterCampanhaWhatsapp } from "@/lib/whatsapp-disparos/campanha-servidor";
import { baileysStatus } from "@/lib/whatsapp-disparos/baileys-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const campanha = await obterCampanhaWhatsapp(ctx.empresaId, id);
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

  const status = await baileysStatus();
  if (!status?.connected) {
    return NextResponse.json(
      { error: "WhatsApp não conectado. Gere o QR Code e conecte antes de iniciar." },
      { status: 422 }
    );
  }
  if (!status.prontoParaEnvio) {
    const segundos = status.warmupRestanteSegundos || 30;
    return NextResponse.json(
      {
        error: `WhatsApp aquecendo — aguarde ${segundos}s após conectar antes de iniciar a campanha.`,
        warmupRestanteSegundos: segundos,
      },
      { status: 422 }
    );
  }

  await iniciarFilaCampanha(ctx.empresaId, id);
  return NextResponse.json({ ok: true });
}
