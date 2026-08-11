import { NextResponse } from "next/server";
import {
  buscarRegistroExtratoPublicaPorToken,
  registroExtratoPublicaValido,
} from "@/lib/extrato-publica";
import { respostaPdfExtratoPublica } from "@/lib/extrato-publica-pdf-resposta";

type Params = { params: Promise<{ token: string; arquivo: string }> };

export const runtime = "nodejs";

/** URL com nome amigável: `/api/financeiro/extrato-publica/{token}/Extrato - Cliente.pdf` */
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

  return respostaPdfExtratoPublica(registro);
}
