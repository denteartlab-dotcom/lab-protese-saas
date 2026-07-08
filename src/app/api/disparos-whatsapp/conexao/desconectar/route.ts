import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { baileysLogout } from "@/lib/whatsapp-disparos/baileys-service";
import { sincronizarSessaoWhatsapp } from "@/lib/whatsapp-disparos/campanha-servidor";

export async function POST() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  await baileysLogout();
  await sincronizarSessaoWhatsapp(ctx.empresaId, { conectado: false, numero: null });
  return NextResponse.json({ ok: true });
}
