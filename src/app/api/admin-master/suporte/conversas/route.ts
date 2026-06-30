import { NextResponse } from "next/server";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { listarConversasMaster } from "@/lib/suporte-chat";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await exigirMasterAdmin();
    const dados = await listarConversasMaster();
    return NextResponse.json(dados);
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}
