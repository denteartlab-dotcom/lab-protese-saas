import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { proximoNumeroPedido } from "@/lib/orcamentos-db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const numeroPedido = await proximoNumeroPedido();
  return NextResponse.json({ numeroPedido });
}
