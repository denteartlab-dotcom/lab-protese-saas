import { NextResponse } from "next/server";
import { anexarLimpezaCookieSessao } from "@/lib/auth";

export async function POST(request: Request) {
  const resposta = NextResponse.json({ ok: true });
  return anexarLimpezaCookieSessao(resposta, request);
}

/** Limpa cookie em Route Handler (páginas Server Component não podem setar cookie). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const destino = url.searchParams.get("redirect")?.trim() || "/login";
  const seguro = destino.startsWith("/") && !destino.startsWith("//") ? destino : "/login";
  const resposta = NextResponse.redirect(new URL(seguro, url.origin));
  return anexarLimpezaCookieSessao(resposta, request);
}
