import { NextResponse } from "next/server";
import {
  buscarRegistroExtratoPublicaPorToken,
  registroExtratoPublicaValido,
} from "@/lib/extrato-publica";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const limpo = token?.trim();
  if (!limpo) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  const registro = await buscarRegistroExtratoPublicaPorToken(limpo);
  if (!registro) {
    return NextResponse.json({ error: "Extrato não encontrado" }, { status: 404 });
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
