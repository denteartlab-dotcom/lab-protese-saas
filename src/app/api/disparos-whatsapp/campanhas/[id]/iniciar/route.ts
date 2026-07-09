import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { iniciarFilaCampanha } from "@/lib/whatsapp-disparos/campaign-queue";
import { obterCampanhaWhatsapp } from "@/lib/whatsapp-disparos/campanha-servidor";
import { baileysStatus } from "@/lib/whatsapp-disparos/baileys-service";
import { sessaoWhatsappProntaParaEnvio } from "@/lib/whatsapp-baileys-status";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const campanha = await obterCampanhaWhatsapp(ctx.empresaId, id);
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

  if (campanha.totalContatos === 0 || campanha.pendentes === 0) {
    return NextResponse.json(
      { error: "Campanha sem contatos para enviar. Importe contatos válidos antes de iniciar." },
      { status: 422 }
    );
  }

  const status = await baileysStatus();
  if (!status?.connected) {
    return NextResponse.json(
      { error: "WhatsApp não conectado. Gere o QR Code e conecte antes de iniciar." },
      { status: 422 }
    );
  }
  if (!sessaoWhatsappProntaParaEnvio(status)) {
    const segundos = status?.warmupRestanteSegundos ?? 12;
    return NextResponse.json(
      {
        error: `WhatsApp ainda aquecendo — aguarde ${segundos}s após conectar e tente novamente.`,
      },
      { status: 422 }
    );
  }

  try {
    await iniciarFilaCampanha(ctx.empresaId, id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao iniciar disparo" },
      { status: 422 }
    );
  }
  return NextResponse.json({ ok: true });
}
