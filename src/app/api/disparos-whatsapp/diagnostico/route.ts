import { NextResponse } from "next/server";
import { obterEmpresaContexto } from "@/lib/empresa-context";
import { diagnosticarWhatsappServidor } from "@/lib/whatsapp-disparos/diagnostico-conexao";

export async function GET() {
  const ctx = await obterEmpresaContexto();
  const diag = await diagnosticarWhatsappServidor(Boolean(ctx));
  return NextResponse.json(diag);
}
