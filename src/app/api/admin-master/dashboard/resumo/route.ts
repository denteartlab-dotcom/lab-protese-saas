import { NextResponse } from "next/server";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import {
  listarCobrancasAssinaturaMaster,
  obterDashboardMaster,
} from "@/lib/master-empresa";

export const dynamic = "force-dynamic";

/** Dashboard master agregado (issue 023). */
export async function GET() {
  try {
    await exigirMasterAdmin();
    const [dashboard, cobrancas] = await Promise.all([
      obterDashboardMaster(),
      listarCobrancasAssinaturaMaster(),
    ]);
    return NextResponse.json({
      dashboard,
      cobrancasRecentes: cobrancas.slice(0, 10),
    });
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}
