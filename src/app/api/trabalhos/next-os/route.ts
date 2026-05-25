import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { proximoNumeroOsDisponivel } from "@/lib/os-sequencia";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const numeroOs = await proximoNumeroOsDisponivel();
  return NextResponse.json({ numeroOs });
}
