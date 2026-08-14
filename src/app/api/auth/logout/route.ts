import { NextResponse } from "next/server";
import { anexarLimpezaCookieSessao } from "@/lib/auth";
import { rejeitarSeOrigemInvalida } from "@/lib/csrf-origin";

export async function POST(request: Request) {
  const csrf = rejeitarSeOrigemInvalida(request);
  if (csrf) return csrf;

  const resposta = NextResponse.json({ ok: true });
  return anexarLimpezaCookieSessao(resposta, request);
}

/** Compat: limpa cookie + redirect. Preferir POST para logout intencional. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const destino = url.searchParams.get("redirect")?.trim() || "/login";
  const seguro = destino.startsWith("/") && !destino.startsWith("//") ? destino : "/login";
  const resposta = NextResponse.redirect(new URL(seguro, url.origin));
  return anexarLimpezaCookieSessao(resposta, request);
}
