import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  buscarTransacoesPluggy,
  pluggyConfigurado,
  transacoesParaExtrato,
} from "@/lib/open-finance/pluggy";

const schema = z.object({
  itemId: z.string().min(1),
  contaId: z.string().min(1),
  dias: z.number().int().min(1).max(365).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!pluggyConfigurado()) {
    return NextResponse.json(
      { error: "Open Finance não configurado no servidor." },
      { status: 503 }
    );
  }

  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const { itemId, contaId, dias } = parsed.data;
    const transacoes = await buscarTransacoesPluggy(itemId, dias ?? 90);
    const movimentacoes = transacoesParaExtrato(contaId, transacoes);

    return NextResponse.json({
      movimentacoes,
      sincronizadoEm: new Date().toISOString(),
      total: movimentacoes.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao sincronizar extrato.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
