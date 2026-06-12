import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import { sincronizarHistoricoMapaEtapas } from "@/lib/historico-etapas";

type Params = { params: Promise<{ key: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { key } = await params;
  const row = await prisma.jsonStore.findUnique({
    where: { key },
  });
  if (!row) {
    return NextResponse.json(null);
  }

  try {
    return NextResponse.json(JSON.parse(row.payload));
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { key } = await params;
  const body = await request.json();

  let mapaAnterior: Record<string, number[]> = {};
  if (key === MODULO_PRODUCAO_ETAPAS_STORAGE_KEY) {
    const row = await prisma.jsonStore.findUnique({ where: { key } });
    if (row?.payload) {
      try {
        const parsed = JSON.parse(row.payload) as Record<string, unknown>;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [chave, valor] of Object.entries(parsed)) {
            if (Array.isArray(valor)) {
              mapaAnterior[chave] = valor.filter((n): n is number => typeof n === "number");
            }
          }
        }
      } catch {
        mapaAnterior = {};
      }
    }
  }

  await prisma.jsonStore.upsert({
    where: { key },
    create: {
      key,
      payload: JSON.stringify(body),
    },
    update: { payload: JSON.stringify(body) },
  });

  if (key === MODULO_PRODUCAO_ETAPAS_STORAGE_KEY && body && typeof body === "object") {
    const mapaNovo = body as Record<string, number[]>;
    try {
      await sincronizarHistoricoMapaEtapas(mapaAnterior, mapaNovo);
    } catch (error) {
      console.error("[json-store/historico-etapas]", error);
    }
  }

  return NextResponse.json({ ok: true });
}
