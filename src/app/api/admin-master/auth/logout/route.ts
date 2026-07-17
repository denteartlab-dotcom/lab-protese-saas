import { NextResponse } from "next/server";
import { anexarLimpezaCookieMasterSessao } from "@/lib/master-auth";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";

export async function POST(request: Request) {
  try {
    const { master } = await exigirMasterAdmin();
    await registrarLogMaster(master.id, "LOGOUT_MASTER", {
      ip: ipDaRequisicao(request),
    });
    const resposta = NextResponse.json({ ok: true });
    return anexarLimpezaCookieMasterSessao(resposta);
  } catch {
    const resposta = respostaNaoAutorizadoMaster();
    return anexarLimpezaCookieMasterSessao(resposta);
  }
}
