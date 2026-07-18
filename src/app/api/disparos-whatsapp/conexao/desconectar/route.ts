import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import { baileysLogout } from "@/lib/whatsapp-disparos/baileys-service";
import { sincronizarSessaoWhatsapp } from "@/lib/whatsapp-disparos/campanha-servidor";

export async function POST() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "disparos-whatsapp", "editar");
  if (negado) return negado;

  await baileysLogout();
  await sincronizarSessaoWhatsapp(ctx.empresaId, { conectado: false, numero: null });
  return NextResponse.json({ ok: true });
}
