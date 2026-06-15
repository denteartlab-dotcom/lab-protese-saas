import { NextResponse } from "next/server";
import { destroyMasterSession } from "@/lib/master-auth";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";

export async function POST(request: Request) {
  try {
    const { master } = await exigirMasterAdmin();
    await registrarLogMaster(master.id, "LOGOUT_MASTER", {
      ip: ipDaRequisicao(request),
    });
    await destroyMasterSession();
    return NextResponse.json({ ok: true });
  } catch {
    await destroyMasterSession();
    return respostaNaoAutorizadoMaster();
  }
}
