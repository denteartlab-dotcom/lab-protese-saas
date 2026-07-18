import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import { duplicarCampanhaWhatsapp } from "@/lib/whatsapp-disparos/campanha-servidor";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "disparos-whatsapp", "criar");
  if (negado) return negado;

  const { id } = await params;
  const campanha = await duplicarCampanhaWhatsapp(ctx.empresaId, id, ctx.user.name);
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true, campanha });
}
