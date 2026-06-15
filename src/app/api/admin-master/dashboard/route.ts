import { NextResponse } from "next/server";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { obterDashboardMaster } from "@/lib/master-empresa";

export async function GET() {
  try {
    await exigirMasterAdmin();
    const dashboard = await obterDashboardMaster();
    return NextResponse.json(dashboard);
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}
