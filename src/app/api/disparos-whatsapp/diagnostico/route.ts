import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import { diagnosticarWhatsappServidor } from "@/lib/whatsapp-disparos/diagnostico-conexao";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(ctx, "disparos-whatsapp", "ver");
  if (negado) return negado;

  const diag = await diagnosticarWhatsappServidor(true);
  return NextResponse.json(diag);
}
