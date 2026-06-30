import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  contarNaoLidasEmpresa,
  enviarMensagemUsuario,
  listarMensagensEmpresa,
} from "@/lib/suporte-chat";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const apenasContagem = url.searchParams.get("contagem") === "1";

  if (apenasContagem) {
    const naoLidas = await contarNaoLidasEmpresa(ctx.empresaId);
    return NextResponse.json({ naoLidas });
  }

  const marcarLidas = url.searchParams.get("marcarLidas") !== "0";
  const dados = await listarMensagensEmpresa(ctx.empresaId, marcarLidas);
  const naoLidas = marcarLidas ? 0 : await contarNaoLidasEmpresa(ctx.empresaId);

  return NextResponse.json({ ...dados, naoLidas });
}

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

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
    return NextResponse.json({ error: "Mensagem muito longa (máx. 4000 caracteres)." }, { status: 400 });
  }

  try {
    const mensagem = await enviarMensagemUsuario({
      empresaId: ctx.empresaId,
      empresaNome: ctx.empresaNome,
      userId: ctx.user.id,
      userName: ctx.user.name,
      texto,
    });
    return NextResponse.json({ mensagem });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao enviar";
    if (msg === "TEXTO_VAZIO") {
      return NextResponse.json({ error: "Digite uma mensagem." }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao enviar mensagem." }, { status: 500 });
  }
}
