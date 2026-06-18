import { NextResponse } from "next/server";
import { sessaoComPapelAtualizado } from "@/lib/auth-acesso";
import type { FaturaImpressaoSessao } from "@/lib/fatura-impressao-sessao";
import {
  lerFaturaImpressaoSessaoServidor,
  salvarFaturaImpressaoSessaoServidor,
} from "@/lib/fatura-impressao-sessao-servidor";

function payloadValido(payload: unknown): payload is FaturaImpressaoSessao {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as FaturaImpressaoSessao;
  return (
    typeof p.html === "string" &&
    p.html.length > 0 &&
    typeof p.numeroFatura === "number" &&
    typeof p.clienteNome === "string" &&
    typeof p.subtitulo === "string" &&
    (p.formato === "a4" || p.formato === "termica")
  );
}

export async function POST(request: Request) {
  const session = await sessaoComPapelAtualizado();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: { id?: string; payload?: FaturaImpressaoSessao };
  try {
    body = (await request.json()) as { id?: string; payload?: FaturaImpressaoSessao };
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const id = body.id?.trim() ?? "";
  if (!id || !payloadValido(body.payload)) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 400 });
  }

  salvarFaturaImpressaoSessaoServidor(id, body.payload);
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

  const payload = lerFaturaImpressaoSessaoServidor(id);
  if (!payload) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  }

  return NextResponse.json(payload);
}
