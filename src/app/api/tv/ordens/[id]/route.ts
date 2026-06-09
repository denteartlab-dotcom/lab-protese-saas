import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getTvOrdensStore } from "@/lib/tv/tv-ordens-store";
import type { ColunaKanbanId } from "@/components/modulo-tv/types";

const schema = z.object({
  coluna: z.enum([
    "entrada",
    "plano_cera",
    "montagem",
    "acrilizacao",
    "acabamento",
    "pronto_entrega",
  ]),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const store = getTvOrdensStore();
  const ordem = store.moverOrdem(id, parsed.data.coluna as ColunaKanbanId);

  if (!ordem) {
    return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ordem, ...store.getSnapshot() });
}
