import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  contarNaoLidasEmpresa,
  enviarMensagemUsuario,
  listarMensagensEmpresa,
  parseCorpoMensagemSuporte,
  respostaErroMensagemSuporte,
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

  try {
    const { texto, imagemUrl } = await parseCorpoMensagemSuporte(request, ctx.empresaId);
    const mensagem = await enviarMensagemUsuario({
      empresaId: ctx.empresaId,
      empresaNome: ctx.empresaNome,
      userId: ctx.user.id,
      userName: ctx.user.name,
      texto,
      imagemUrl,
    });
    return NextResponse.json({ mensagem });
  } catch (e) {
    const resposta = respostaErroMensagemSuporte(e);
    return NextResponse.json({ error: resposta.error }, { status: resposta.status });
  }
}
