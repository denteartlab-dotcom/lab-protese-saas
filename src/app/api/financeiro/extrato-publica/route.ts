import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  chaveExtratoPublica,
  criarTokenExtratoPublica,
  extratoPublicaUrl,
  montarRegistroExtratoPublica,
} from "@/lib/extrato-publica";
import { publicOriginFromRequest } from "@/lib/whatsapp";

const bodySchema = z.object({
  base64: z.string().min(1),
  nomeArquivo: z.string().min(1).max(180),
  titulo: z.string().min(1).max(240),
  clienteNome: z.string().min(1).max(240),
  conteudo: z
    .object({
      modelo: z.enum([
        "extrato-individual",
        "extrato-2-individual",
        "extrato-3-agrupado-paciente",
      ]),
      clienteNome: z.string(),
      periodoLabel: z.string(),
    })
    .passthrough()
    .optional(),
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

  const token = criarTokenExtratoPublica();
  const registro = montarRegistroExtratoPublica(parsed.data);

  await prisma.jsonStore.upsert({
    where: { key: chaveExtratoPublica(token) },
    create: {
      key: chaveExtratoPublica(token),
      payload: JSON.stringify(registro),
    },
    update: { payload: JSON.stringify(registro) },
  });

  const origin = publicOriginFromRequest(request);
  return NextResponse.json({
    token,
    url: extratoPublicaUrl(token, origin),
  });
}
