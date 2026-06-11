import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  chaveFaturaPublica,
  criarTokenFaturaPublica,
  faturaPublicaUrl,
  montarRegistroFaturaPublica,
} from "@/lib/fatura-publica";

const bodySchema = z.object({
  base64: z.string().min(1),
  nomeArquivo: z.string().min(1).max(180),
  titulo: z.string().min(1).max(240),
  numeroFatura: z.number().int().positive(),
  clienteNome: z.string().min(1).max(240),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const token = criarTokenFaturaPublica();
  const registro = montarRegistroFaturaPublica(parsed.data);

  await prisma.jsonStore.upsert({
    where: { key: chaveFaturaPublica(token) },
    create: {
      key: chaveFaturaPublica(token),
      payload: JSON.stringify(registro),
    },
    update: { payload: JSON.stringify(registro) },
  });

  return NextResponse.json({
    token,
    url: faturaPublicaUrl(token),
  });
}
