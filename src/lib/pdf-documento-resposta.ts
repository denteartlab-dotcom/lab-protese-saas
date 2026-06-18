import { NextResponse } from "next/server";
import { contentDispositionPdf } from "@/lib/pdf-documento-http";

/** Resposta binária compatível com NextResponse (evita erro TS com Buffer/Uint8Array). */
export function respostaPdfBase64(
  base64: string,
  opcoes: { mimeType: string; nomeArquivo: string; download: boolean }
) {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length) return null;

  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  );

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": opcoes.mimeType,
      "Content-Disposition": contentDispositionPdf(opcoes.nomeArquivo, opcoes.download),
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
