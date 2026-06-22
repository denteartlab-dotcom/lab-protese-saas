import { NextResponse } from "next/server";
import { aquecerConexaoBanco } from "@/lib/servidor-saude";

export const dynamic = "force-dynamic";

/** Saúde do app + banco (cron/nginx/PM2). */
export async function GET() {
  try {
    await aquecerConexaoBanco();
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
