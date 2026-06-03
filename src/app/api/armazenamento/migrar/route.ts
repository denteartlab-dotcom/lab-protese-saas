import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  migrarJsonStoreLaboratorio,
  salvarJsonStoreServidor,
} from "@/lib/json-store-servidor";
import { ARMAZENAMENTO_LAB_PREFIX } from "@/lib/armazenamento-laboratorio-keys";

const schema = z.object({
  entradas: z.record(z.string(), z.unknown()),
  sobrescrever: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = schema.parse(await request.json());
    const gravadas: string[] = [];

    if (body.sobrescrever) {
      for (const [key, valor] of Object.entries(body.entradas)) {
        if (!key.startsWith(ARMAZENAMENTO_LAB_PREFIX)) continue;
        await salvarJsonStoreServidor(key, valor);
        gravadas.push(key);
      }
    } else {
      const novas = await migrarJsonStoreLaboratorio(body.entradas);
      gravadas.push(...novas);
    }

    return NextResponse.json({ ok: true, gravadas });
  } catch (err) {
    console.error("[armazenamento/migrar]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Não foi possível gravar os dados." },
      { status: 500 }
    );
  }
}
