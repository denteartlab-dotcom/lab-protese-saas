import { parseNfePdf } from "@/lib/nfe-pdf";
import { parseNfeXml, type DadosNfeImportados } from "@/lib/nfe-xml";

function ehXml(texto: string) {
  const t = texto.trim();
  return t.startsWith("<") && (t.includes("<NFe") || t.includes("infNFe") || t.includes("<?xml"));
}

/** Importa NF-e a partir de arquivo XML ou PDF. */
export async function parseNotaFiscalArquivo(
  file: File
): Promise<DadosNfeImportados> {
  const nome = file.name.toLowerCase();

  if (nome.endsWith(".pdf") || file.type === "application/pdf") {
    return parseNfePdf(file);
  }

  const texto = await file.text();
  if (ehXml(texto)) {
    return parseNfeXml(texto);
  }

  if (nome.endsWith(".xml") || nome.endsWith(".nfe")) {
    return parseNfeXml(texto);
  }

  throw new Error(
    "Formato não suportado. Envie o PDF ou o XML da nota fiscal (NF-e)."
  );
}

export type { DadosNfeImportados } from "@/lib/nfe-xml";
