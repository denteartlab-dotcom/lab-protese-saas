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

  const body = Buffer.from(registro.base64, "base64");
  const nomeArquivo = (registro.nomeArquivo || "extrato.pdf").replace(
    /[\\/:*?"<>|]/g,
    "_"
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `inline; filename="${encodeURIComponent(nomeArquivo)}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`,
    },
  });
}
