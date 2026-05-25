import { dateToBrShort } from "@/lib/datas-br";
import {
  parseNfeXml,
  type DadosNfeImportados,
  type ItemNfeImportado,
} from "@/lib/nfe-xml";

function moedaBrParaNumero(valor: string) {
  const limpo = valor
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function formatarCnpj(digits: string) {
  const d = digits.replace(/\D/g, "").slice(0, 14);
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function extrairCnpjs(texto: string) {
  const encontrados: string[] = [];
  const regex =
    /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{14}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto)) !== null) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length === 14 || digits.length === 11) {
      encontrados.push(digits.length === 14 ? formatarCnpj(digits) : digits);
    }
  }
  return encontrados;
}

function extrairValorTotal(texto: string) {
  const padroes = [
    /VALOR\s+TOTAL\s+(?:DA\s+NOTA|NF|DOS\s+PRODUTOS|SERVI[CÇ]OS)[^\d]{0,40}(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    /TOTAL\s+DA\s+NOTA[^\d]{0,30}(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    /V\.?\s*NF\s*[^\d]{0,20}(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    /VALOR\s+TOTAL\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    /TOTAL\s+GERAL[^\d]{0,25}(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  ];

  for (const re of padroes) {
    const m = texto.match(re);
    if (m?.[1]) {
      const v = moedaBrParaNumero(m[1]);
      if (v > 0) return v;
    }
  }

  const valores = [...texto.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})/g)]
    .map((x) => moedaBrParaNumero(x[1]))
    .filter((v) => v > 0);
  return valores.length > 0 ? Math.max(...valores) : 0;
}

function extrairNumeroSerie(texto: string) {
  const numero =
    texto.match(/N[ºo°\.]?\s*(?:DA\s+)?NOTA\s*FISCAL[^\d]{0,20}(\d{1,9})/i)?.[1] ||
    texto.match(/N[ºo°]\s*(\d{1,9})/i)?.[1] ||
    texto.match(/NOTA\s+FISCAL[^\d]{0,15}(\d{1,9})/i)?.[1] ||
    "";
  const serie =
    texto.match(/S[ÉE]RIE\s*[:\s]*(\d{1,5})/i)?.[1] ||
    texto.match(/Série\s*(\d+)/i)?.[1] ||
    "";
  return { numero: numero.trim(), serie: serie.trim() };
}

function extrairDataEmissao(texto: string) {
  const padroes = [
    /DATA\s+(?:DE\s+)?EMISS[AÃ]O\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
    /EMISS[AÃ]O\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
    /(\d{2}\/\d{2}\/\d{4})/,
  ];
  for (const re of padroes) {
    const m = texto.match(re);
    if (m?.[1]) return m[1];
  }
  return dateToBrShort(new Date());
}

function extrairNomeEmitente(texto: string) {
  const blocoEmitente = texto.split(/DESTINAT[ÁA]RIO|DADOS\s+DO\s+DESTINAT/i)[0];

  const razao =
    blocoEmitente.match(
      /RAZ[AÃ]O\s+SOCIAL\s*[:\s]*([^\n\r]{3,120})/i
    )?.[1] ||
    blocoEmitente.match(
      /NOME\s*\/?\s*RAZ[AÃ]O\s+SOCIAL\s*[:\s]*([^\n\r]{3,120})/i
    )?.[1];

  if (razao) {
    return razao.replace(/\s{2,}/g, " ").trim().slice(0, 120);
  }

  const linhas = blocoEmitente
    .split(/\n|\r/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(
      (l) =>
        l.length > 4 &&
        !/danfe|documento auxiliar|nota fiscal|chave de acesso|identifica/i.test(
          l
        ) &&
        !/^\d{2}\.\d{3}/.test(l)
    );

  return linhas[0] || linhas[1] || "";
}

function extrairXmlEmbutido(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);
  const decoders = [
    () => new TextDecoder("utf-8", { fatal: false }).decode(bytes),
    () => new TextDecoder("latin1").decode(bytes),
  ];

  for (const decode of decoders) {
    const raw = decode();
    const inicioNfe = raw.indexOf("<NFe");
    const inicioXml = raw.indexOf("<?xml");
    const start =
      inicioNfe >= 0 && (inicioXml < 0 || inicioNfe < inicioXml)
        ? inicioNfe
        : inicioXml;
    if (start < 0) continue;

    const fimProc = raw.indexOf("</nfeProc>", start);
    const fimNfe = raw.indexOf("</NFe>", start);
    const end =
      fimProc >= 0 ? fimProc + "</nfeProc>".length : fimNfe >= 0 ? fimNfe + "</NFe>".length : -1;
    if (end > start) {
      const trecho = raw.slice(start, end);
      if (trecho.includes("infNFe") || trecho.includes("<NFe")) return trecho;
    }
  }
  return null;
}

async function carregarPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    const versao = pdfjs.version || "4.10.38";
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${versao}/build/pdf.worker.min.mjs`;
    }
  }
  return pdfjs;
}

export async function extrairTextoPdf(file: File): Promise<string> {
  const pdfjs = await carregarPdfJs();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const partes: string[] = [];

  for (let pagina = 1; pagina <= doc.numPages; pagina++) {
    const page = await doc.getPage(pagina);
    const content = await page.getTextContent();
    const linha = content.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ");
    partes.push(linha);
  }

  return partes.join("\n");
}

/** Interpreta texto do DANFE (PDF) quando não há XML embutido. */
export function parseNfeTextoDanfe(texto: string): DadosNfeImportados {
  const normalizado = texto.replace(/\s+/g, " ").trim();
  const { numero, serie } = extrairNumeroSerie(normalizado);
  const emitenteCnpj = extrairCnpjs(normalizado.split(/DESTINAT/i)[0] || normalizado)[0] || "";
  const emitenteNome = extrairNomeEmitente(texto);
  const valorTotal = extrairValorTotal(normalizado);

  if (valorTotal <= 0) {
    throw new Error(
      "Não foi possível identificar o valor total no PDF. Tente o arquivo XML da NF-e."
    );
  }

  const referencia = [numero, serie].filter(Boolean).join("/") || "PDF";
  const itens: ItemNfeImportado[] = [
    {
      produto: emitenteNome || "Nota fiscal (PDF)",
      descricao: `Importado NF ${referencia}`,
      quantidade: 1,
      valorUnitario: valorTotal,
    },
  ];

  return {
    numero,
    serie,
    referencia: numero ? `NF ${referencia}` : "NF PDF",
    dataEmissao: extrairDataEmissao(normalizado),
    emitenteNome,
    emitenteCnpj,
    valorTotal,
    itens,
  };
}

/** Lê PDF de NF-e: XML embutido (prioridade) ou texto do DANFE. */
export async function parseNfePdf(file: File): Promise<DadosNfeImportados> {
  const buffer = await file.arrayBuffer();
  const xmlEmbutido = extrairXmlEmbutido(buffer);
  if (xmlEmbutido) {
    try {
      return parseNfeXml(xmlEmbutido);
    } catch {
      // segue para leitura por texto
    }
  }

  const texto = await extrairTextoPdf(file);
  if (!texto.trim()) {
    throw new Error("Não foi possível extrair texto do PDF.");
  }
  return parseNfeTextoDanfe(texto);
}
