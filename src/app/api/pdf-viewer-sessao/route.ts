import { NextResponse } from "next/server";
import { sessaoComPapelAtualizado } from "@/lib/auth-acesso";
import type { PdfViewerSessionPayload } from "@/lib/pdf-viewer-aba";
import {
  lerSessaoPdfViewerServidor,
  removerSessaoPdfViewerServidor,
  salvarSessaoPdfViewerServidor,
} from "@/lib/pdf-viewer-sessao-servidor";

export async function POST(request: Request) {
  const session = await sessaoComPapelAtualizado();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: { id?: string; payload?: PdfViewerSessionPayload };
  try {
    body = (await request.json()) as { id?: string; payload?: PdfViewerSessionPayload };
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const id = body.id?.trim() ?? "";
  const payload = body.payload;
  if (!id || !payload || payload.status !== "ready" || !payload.base64) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 400 });
  }

  salvarSessaoPdfViewerServidor(id, payload);
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const session = await sessaoComPapelAtualizado();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "ID ausente." }, { status: 400 });
  }

  const payload = lerSessaoPdfViewerServidor(id);
  if (!payload) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  }

  removerSessaoPdfViewerServidor(id);
  return NextResponse.json(payload);
}
