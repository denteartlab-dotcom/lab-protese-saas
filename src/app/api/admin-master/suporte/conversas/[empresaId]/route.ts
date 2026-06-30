import { NextResponse } from "next/server";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import {
  enviarMensagemSuporte,
  listarMensagensMaster,
  parseCorpoMensagemSuporte,
  respostaErroMensagemSuporte,
} from "@/lib/suporte-chat";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ empresaId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    await exigirMasterAdmin();
    const { empresaId } = await params;
    const url = new URL(request.url);
    const marcarLidas = url.searchParams.get("marcarLidas") !== "0";
    const dados = await listarMensagensMaster(empresaId, marcarLidas);
    return NextResponse.json(dados);
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { master } = await exigirMasterAdmin();
    const { empresaId } = await params;

    const { texto, imagemUrl } = await parseCorpoMensagemSuporte(request, empresaId);
    const mensagem = await enviarMensagemSuporte({
      empresaId,
      masterId: master.id,
      masterNome: master.nome,
      texto,
      imagemUrl,
    });

    return NextResponse.json({ mensagem });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return respostaNaoAutorizadoMaster();
    }
    const resposta = respostaErroMensagemSuporte(e);
    return NextResponse.json({ error: resposta.error }, { status: resposta.status });
  }
}
