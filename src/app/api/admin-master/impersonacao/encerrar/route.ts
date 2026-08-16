import { NextResponse } from "next/server";
import {
  anexarLimpezaCookieSessao,
  getSession,
  sessaoEhSuporteMaster,
} from "@/lib/auth";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { master } = await exigirMasterAdmin();
    const labSession = await getSession();

    const empresaId = labSession?.empresaId;
    const detalhes =
      labSession && sessaoEhSuporteMaster(labSession)
        ? `Visualização encerrada: ${labSession.empresaNome ?? labSession.empresaSlug ?? empresaId ?? "empresa"}`
        : "Sessão de visualização do cliente encerrada.";

    await registrarLogMaster(master.id, "ENCERRAR_VISUALIZACAO_EMPRESA", {
      empresaId,
      detalhes,
      ip: ipDaRequisicao(request),
    });

    const response = NextResponse.json({
      ok: true,
      redirectTo: "/admin-master",
    });

    // Remove somente o cookie do lab; a sessão master permanece intacta.
    return anexarLimpezaCookieSessao(response, request);
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}
