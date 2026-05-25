import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { criarConnectToken, pluggyConfigurado } from "@/lib/open-finance/pluggy";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!pluggyConfigurado()) {
    return NextResponse.json(
      {
        error:
          "Open Finance não configurado no servidor. Use importação de extrato (OFX/CSV) ou configure as credenciais Pluggy.",
      },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { itemId?: string };
    const accessToken = await criarConnectToken(body.itemId);
    return NextResponse.json({ accessToken });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar token de conexão.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
