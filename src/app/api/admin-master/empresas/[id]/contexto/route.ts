import { NextResponse } from "next/server";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { obterEmpresaDetalheMaster } from "@/lib/master-empresa";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await exigirMasterAdmin();
    const { id } = await params;
    const contexto = await obterEmpresaDetalheMaster(id);
    if (!contexto) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    return NextResponse.json(contexto);
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}
