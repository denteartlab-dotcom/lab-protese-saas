import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { duplicarCampanhaWhatsapp } from "@/lib/whatsapp-disparos/campanha-servidor";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const campanha = await duplicarCampanhaWhatsapp(ctx.empresaId, id, ctx.user.name);
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true, campanha });
}
