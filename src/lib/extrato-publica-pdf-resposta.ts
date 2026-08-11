import { NextResponse } from "next/server";
import { nomeArquivoExtratoCliente } from "@/lib/extrato-arquivo-nome";
import type { ExtratoPublicaRegistro } from "@/lib/extrato-publica-cliente";

/** Nome seguro para path/header do PDF público. */
export function normalizarNomeArquivoExtratoPdf(
  nomeArquivo?: string | null,
  clienteNome?: string | null
) {
  const bruto = (nomeArquivo || "").trim() || nomeArquivoExtratoCliente(clienteNome);
  const limpo = bruto
    .replace(/[\\/:*?"<>|\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return limpo.toLowerCase().endsWith(".pdf") ? limpo : `${limpo || "Extrato"}.pdf`;
}

/** Content-Disposition correto (ASCII + UTF-8) para o navegador exibir o nome do arquivo. */
export function contentDispositionPdfInline(nomeArquivo: string) {
  const seguro = normalizarNomeArquivoExtratoPdf(nomeArquivo);
  const ascii = seguro.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const utf8 = encodeURIComponent(seguro).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/** Segmento de URL com o nome do PDF (Chrome usa isso como título da aba). */
export function segmentoUrlNomeArquivoPdf(nomeArquivo: string) {
  return encodeURIComponent(normalizarNomeArquivoExtratoPdf(nomeArquivo));
}

export function respostaPdfExtratoPublica(registro: ExtratoPublicaRegistro) {
  const body = Buffer.from(registro.base64, "base64");
  const nomeArquivo = normalizarNomeArquivoExtratoPdf(
    registro.nomeArquivo,
    registro.clienteNome
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": contentDispositionPdfInline(nomeArquivo),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
