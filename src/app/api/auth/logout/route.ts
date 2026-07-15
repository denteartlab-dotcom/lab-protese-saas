import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

/** Limpa cookie em Route Handler (páginas Server Component não podem setar cookie). */
export async function GET(request: Request) {
  await destroySession();
  const url = new URL(request.url);
  const destino = url.searchParams.get("redirect")?.trim() || "/login";
  const seguro = destino.startsWith("/") && !destino.startsWith("//") ? destino : "/login";
  return NextResponse.redirect(new URL(seguro, url.origin));
}
