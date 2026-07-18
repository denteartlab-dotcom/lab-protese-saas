import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import { continuarFilaCampanha } from "@/lib/whatsapp-disparos/campaign-queue";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "disparos-whatsapp", "editar");
  if (negado) return negado;

  const { id } = await params;
  await continuarFilaCampanha(ctx.empresaId, id);
  return NextResponse.json({ ok: true });
}
