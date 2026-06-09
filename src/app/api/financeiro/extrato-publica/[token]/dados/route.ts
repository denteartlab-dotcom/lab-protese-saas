import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  chaveExtratoPublica,
  type ExtratoPublicaRegistro,
  registroExtratoPublicaValido,
} from "@/lib/extrato-publica";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const limpo = token?.trim();
  if (!limpo) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  const row = await prisma.jsonStore.findUnique({
    where: { key: chaveExtratoPublica(limpo) },
  });

  if (!row) {
    return NextResponse.json({ error: "Extrato não encontrado" }, { status: 404 });
  }

  let registro: ExtratoPublicaRegistro;
  try {
    registro = JSON.parse(row.payload) as ExtratoPublicaRegistro;
  } catch {
    return NextResponse.json({ error: "Registro inválido" }, { status: 500 });
  }

  if (!registroExtratoPublicaValido(registro)) {
    return NextResponse.json({ error: "Link expirado" }, { status: 410 });
  }

  return NextResponse.json({
    titulo: registro.titulo,
    nomeArquivo: registro.nomeArquivo,
    clienteNome: registro.clienteNome,
    temPdf: Boolean(registro.base64),
  });
}
