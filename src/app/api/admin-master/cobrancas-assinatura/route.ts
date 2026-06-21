import { NextResponse } from "next/server";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { listarCobrancasAssinaturaMaster } from "@/lib/master-empresa";

export async function GET() {
  try {
    await exigirMasterAdmin();
    const cobrancas = await listarCobrancasAssinaturaMaster();
    const pendentes = cobrancas.filter((c) => c.pixAberta);
    const pagas = cobrancas.filter((c) => c.pago);
    return NextResponse.json({ pendentes, pagas, total: cobrancas.length });
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}
