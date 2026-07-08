import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { enviarMensagemWhatsapp } from "@/lib/whatsapp-enviar";

const schema = z.object({
  telefone: z.string().min(8),
  mensagem: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = schema.parse(body);
    const resultado = await enviarMensagemWhatsapp(data.telefone, data.mensagem);
    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.error }, { status: 422 });
    }
    return NextResponse.json({ ok: true, modo: resultado.modo });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao enviar WhatsApp" },
      { status: 500 }
    );
  }
}
