import { NextResponse } from "next/server";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { cobrancaAssinaturaPixAberta } from "@/lib/assinatura-pix-provedor";
import { listarCobrancasAssinaturaMaster } from "@/lib/master-empresa";

export async function GET() {
  try {
    await exigirMasterAdmin();
    const cobrancas = await listarCobrancasAssinaturaMaster();
    const pendentes = cobrancas.filter(
      (c) =>
        !c.pago &&
        cobrancaAssinaturaPixAberta({
          provedor: c.provedor,
          statusAsaas: c.statusAsaas,
          pixExpiraEm: c.pixExpiraEm ? new Date(c.pixExpiraEm) : null,
          createdAt: new Date(c.createdAt),
          pagoEm: c.pagoEm ? new Date(c.pagoEm) : null,
        })
    );
    const pagas = cobrancas.filter((c) => c.pago);
    return NextResponse.json({ pendentes, pagas, total: cobrancas.length });
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}
