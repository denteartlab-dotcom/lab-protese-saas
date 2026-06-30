import { NextResponse } from "next/server";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import {
  enviarMensagemSuporte,
  listarMensagensMaster,
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

    let body: { texto?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
    }

    const texto = (body.texto ?? "").trim();
    if (!texto) {
      return NextResponse.json({ error: "Digite uma mensagem." }, { status: 400 });
    }
    if (texto.length > 4000) {
      return NextResponse.json(
        { error: "Mensagem muito longa (máx. 4000 caracteres)." },
        { status: 400 }
      );
    }

    const mensagem = await enviarMensagemSuporte({
      empresaId,
      masterId: master.id,
      masterNome: master.nome,
      texto,
    });

    return NextResponse.json({ mensagem });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return respostaNaoAutorizadoMaster();
    }
    return NextResponse.json({ error: "Erro ao enviar mensagem." }, { status: 500 });
  }
}
