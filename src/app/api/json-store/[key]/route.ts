import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

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

  await prisma.jsonStore.upsert({
    where: { key },
    create: {
      key,
      payload: JSON.stringify(body),
    },
    update: { payload: JSON.stringify(body) },
  });

  return NextResponse.json({ ok: true });
}
