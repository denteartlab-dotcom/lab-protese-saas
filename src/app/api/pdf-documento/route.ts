import { NextResponse } from "next/server";
import { sessaoComPapelAtualizado } from "@/lib/auth-acesso";
import { respostaPdfBase64 } from "@/lib/pdf-documento-resposta";
import {
  lerSessaoPdfViewerServidor,
  salvarSessaoPdfViewerServidor,
} from "@/lib/pdf-viewer-sessao-servidor";
import type { PdfViewerSessionPayload } from "@/lib/pdf-viewer-aba";

export async function POST(request: Request) {
  const session = await sessaoComPapelAtualizado();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: {
    id?: string;
    base64?: string;
    nomeArquivo?: string;
    mimeType?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const id = body.id?.trim() ?? "";
  const base64 = body.base64?.trim() ?? "";
  const nomeArquivo = body.nomeArquivo?.trim() || "documento.pdf";
  if (!id || !base64) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }

  const payload: PdfViewerSessionPayload = {
    status: "ready",
    base64,
    nomeArquivo,
    mimeType: body.mimeType?.trim() || "application/pdf",
  };
  salvarSessaoPdfViewerServidor(id, payload);
  return NextResponse.json({ ok: true, id });
}

function responderPdf(
  payload: PdfViewerSessionPayload,
  nomePreferido: string,
  download: boolean
) {
  const nomeArquivo = payload.nomeArquivo?.trim() || nomePreferido || "documento.pdf";
  const mimeType = payload.mimeType?.trim() || "application/pdf";

  const resposta = respostaPdfBase64(payload.base64 ?? "", {
    mimeType,
    nomeArquivo,
    download,
  });
  if (!resposta) {
    return NextResponse.json({ error: "Documento vazio." }, { status: 404 });
  }
  return resposta;
}

/** GET legado: /api/pdf-documento?id=... */
export async function GET(request: Request) {
  const session = await sessaoComPapelAtualizado();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "ID ausente." }, { status: 400 });
  }

  const payload = lerSessaoPdfViewerServidor(id);
  if (!payload?.base64 || payload.status !== "ready") {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const download = url.searchParams.get("download") === "1";
  const nomeQuery = url.searchParams.get("nome")?.trim() ?? "";
  return responderPdf(payload, nomeQuery, download);
}
