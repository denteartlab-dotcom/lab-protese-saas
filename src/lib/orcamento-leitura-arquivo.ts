import type { ItemOrcamento } from "@/lib/orcamentos-types";
import {
  extrairLinhasTextoHeuristico,
  normalizarTextoProduto,
  preencherItensComLinhas,
  validarArquivoOrcamento,
  type LinhaOrcamentoLida,
  type ResultadoLeituraOrcamento,
} from "@/lib/orcamento-leitura-match";

export type {
  LinhaOrcamentoLida,
  MatchOrcamentoLeitura,
  ResultadoLeituraOrcamento,
} from "@/lib/orcamento-leitura-match";

export {
  casarLinhasComItens,
  extrairLinhasTextoHeuristico,
  normalizarTextoProduto,
  preencherItensComLinhas,
  preencherItensComTexto,
  similaridadeNomes,
  validarArquivoOrcamento,
} from "@/lib/orcamento-leitura-match";

const PROMPT_EXTRACAO = [
  "Você lê orçamentos, cotações, listas de preços e notas de fornecedores (PDF ou imagem).",
  "Extraia cada linha de produto com nome e valor unitário em reais (BRL).",
  "Responda SOMENTE um JSON array válido, sem markdown, no formato:",
  '[{"nome":"texto do produto","quantidade":1,"valorUnitario":12.5,"codigoBarras":"","marca":""}]',
  "Regras:",
  "- valorUnitario é número (use ponto decimal). Se só houver total da linha e quantidade, calcule o unitário.",
  "- quantidade padrão 1 se não aparecer.",
  "- Ignore totais gerais, frete, impostos e cabeçalhos sem produto.",
  "- Mantenha o nome como aparece no documento (não invente).",
].join("\n");

function parseJsonLinhas(texto: string): LinhaOrcamentoLida[] {
  const limpo = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const inicio = limpo.indexOf("[");
  const fim = limpo.lastIndexOf("]");
  if (inicio < 0 || fim <= inicio) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(limpo.slice(inicio, fim + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: LinhaOrcamentoLida[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const nome = String(r.nome || r.produto || r.descricao || "").trim();
    const valorUnitario = Number(r.valorUnitario ?? r.preco ?? r.valor ?? 0);
    if (!nome || !(valorUnitario > 0)) continue;
    const quantidade = Number(r.quantidade ?? 1);
    out.push({
      nome,
      valorUnitario,
      quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1,
      codigoBarras: String(r.codigoBarras || r.ean || "").trim() || undefined,
      marca: String(r.marca || "").trim() || undefined,
    });
  }
  return out;
}

async function chamarGeminiPartes(
  parts: Array<Record<string, unknown>>
): Promise<LinhaOrcamentoLida[] | null> {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const texto = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim();
    if (!texto) return null;
    const linhas = parseJsonLinhas(texto);
    return linhas.length > 0 ? linhas : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function chamarOpenAIVisao(
  mime: string,
  base64: string
): Promise<LinhaOrcamentoLida[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!mime.startsWith("image/")) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 4096,
        messages: [
          { role: "system", content: PROMPT_EXTRACAO },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os itens deste documento." },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const texto = data.choices?.[0]?.message?.content?.trim();
    if (!texto) return null;
    const linhas = parseJsonLinhas(texto);
    return linhas.length > 0 ? linhas : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function extrairLinhasComIa(
  mime: string,
  base64: string,
  textoPdf?: string
): Promise<LinhaOrcamentoLida[] | null> {
  const parts: Array<Record<string, unknown>> = [{ text: PROMPT_EXTRACAO }];
  if (textoPdf && textoPdf.trim().length > 40) {
    parts.push({
      text: `Texto extraído do PDF:\n${textoPdf.slice(0, 12000)}`,
    });
  } else if (base64) {
    parts.push({
      inline_data: { mime_type: mime, data: base64 },
    });
  }

  const gemini = await chamarGeminiPartes(parts);
  if (gemini) return gemini;

  if (textoPdf && textoPdf.trim().length > 40) {
    const geminiTexto = await chamarGeminiPartes([
      { text: `${PROMPT_EXTRACAO}\n\nTexto:\n${textoPdf.slice(0, 12000)}` },
    ]);
    if (geminiTexto) return geminiTexto;
  }

  return base64 ? chamarOpenAIVisao(mime, base64) : null;
}

async function extrairTextoPdfBuffer(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc =
        "pdfjs-dist/legacy/build/pdf.worker.mjs";
    }
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
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
  } catch {
    try {
      const { extrairTextoPdf } = await import("@/lib/nfe-pdf");
      const file = new File([buffer], "orcamento.pdf", {
        type: "application/pdf",
      });
      return await extrairTextoPdf(file);
    } catch {
      return "";
    }
  }
}

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

function consolidarLinhas(
  ia: LinhaOrcamentoLida[] | null,
  heuristicas: LinhaOrcamentoLida[]
): { linhas: LinhaOrcamentoLida[]; fonte: ResultadoLeituraOrcamento["fonte"] } {
  if (ia && ia.length > 0 && heuristicas.length > ia.length * 1.5) {
    const mapa = new Map<string, LinhaOrcamentoLida>();
    for (const l of [...ia, ...heuristicas]) {
      const k = normalizarTextoProduto(l.nome);
      if (!k) continue;
      if (!mapa.has(k)) mapa.set(k, l);
    }
    return { linhas: [...mapa.values()], fonte: "misto" };
  }
  if (ia && ia.length > 0) {
    return {
      linhas: ia,
      fonte: heuristicas.length > 0 ? "misto" : "ia",
    };
  }
  return { linhas: heuristicas, fonte: "texto" };
}

export async function lerPayloadOrcamento(params: {
  itens: ItemOrcamento[];
  mimeType?: string;
  base64?: string;
  texto?: string;
  nomeArquivo?: string;
}): Promise<ResultadoLeituraOrcamento> {
  const { itens } = params;
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error("O orçamento não tem itens para preencher.");
  }

  const textoPdf = (params.texto || "").trim();
  const mime =
    (params.mimeType || "").toLowerCase() ||
    (params.nomeArquivo?.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "image/jpeg");
  const base64 = params.base64 || "";

  const heuristicas = textoPdf ? extrairLinhasTextoHeuristico(textoPdf) : [];
  const ia =
    base64 || textoPdf.length > 40
      ? await extrairLinhasComIa(mime || "text/plain", base64, textoPdf)
      : null;

  const { linhas, fonte } = consolidarLinhas(ia, heuristicas);
  return preencherItensComLinhas(itens, linhas, fonte);
}

export async function lerArquivoEPreencherItens(
  file: File,
  itens: ItemOrcamento[],
  textoExtraido?: string
): Promise<ResultadoLeituraOrcamento> {
  const erro = validarArquivoOrcamento(file);
  if (erro) throw new Error(erro);

  const mime =
    file.type ||
    (file.name.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "image/jpeg");
  const buffer = await file.arrayBuffer();
  const base64 = toBase64(buffer);

  let textoPdf = (textoExtraido || "").trim();
  if (
    !textoPdf &&
    (mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
  ) {
    textoPdf = await extrairTextoPdfBuffer(buffer);
  }

  return lerPayloadOrcamento({
    itens,
    mimeType: mime,
    base64,
    texto: textoPdf,
    nomeArquivo: file.name,
  });
}

