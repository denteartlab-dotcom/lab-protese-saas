import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  chaveFaturaPublica,
  type FaturaPublicaRegistro,
  registroFaturaPublicaValido,
} from "@/lib/fatura-publica";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const limpo = token?.trim();
  if (!limpo) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  const row = await prisma.jsonStore.findUnique({
    where: { key: chaveFaturaPublica(limpo) },
  });

  if (!row) {
    return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 });
  }

  let registro: FaturaPublicaRegistro;
  try {
    registro = JSON.parse(row.payload) as FaturaPublicaRegistro;
  } catch {
    return NextResponse.json({ error: "Registro inválido" }, { status: 500 });
  }

  if (!registroFaturaPublicaValido(registro)) {
    return NextResponse.json({ error: "Link expirado" }, { status: 410 });
  }

  const body = Buffer.from(registro.base64, "base64");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `inline; filename="${encodeURIComponent(registro.nomeArquivo || "fatura.pdf")}"`,
    },
  });
}
