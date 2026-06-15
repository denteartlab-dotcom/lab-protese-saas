import { NextResponse } from "next/server";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";

export async function GET() {
  try {
    const { master } = await exigirMasterAdmin();
    return NextResponse.json({
      id: master.id,
      name: master.nome,
      email: master.email,
      role: master.role,
      isMasterAdmin: true,
    });
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}
