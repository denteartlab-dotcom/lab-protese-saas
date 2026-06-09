import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTvOrdensStore } from "@/lib/tv/tv-ordens-store";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const store = getTvOrdensStore();
  if (store.getChart().length === 0) {
    await store.refreshFromDb();
  }
  return NextResponse.json({ pontos: store.getChart() });
}
