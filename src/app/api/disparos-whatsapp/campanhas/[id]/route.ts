import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  excluirCampanhaWhatsapp,
  obterCampanhaWhatsapp,
} from "@/lib/whatsapp-disparos/campanha-servidor";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const campanha = await obterCampanhaWhatsapp(ctx.empresaId, id);
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  return NextResponse.json({ campanha });
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  await excluirCampanhaWhatsapp(ctx.empresaId, id);
  return NextResponse.json({ ok: true });
}
