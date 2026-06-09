import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTvOrdensStore } from "@/lib/tv/tv-ordens-store";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const store = getTvOrdensStore();
  return NextResponse.json({ pontos: store.getChart() });
}
