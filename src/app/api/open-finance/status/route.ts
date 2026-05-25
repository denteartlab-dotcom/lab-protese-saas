import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pluggyConfigurado } from "@/lib/open-finance/pluggy";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const configurado = pluggyConfigurado();
  return NextResponse.json({
    configurado,
    mensagem: configurado
      ? undefined
      : "Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no servidor para conectar internet banking (Open Finance).",
  });
}
