import type { ItemOrcamento } from "@/lib/orcamentos-types";
import {
  extrairLinhasTextoHeuristico,
  normalizarLinhaOrcamentoLida,
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
  limparDescricaoProdutoArquivo,
  mensagemResultadoLeitura,
  normalizarLinhaOrcamentoLida,
  normalizarTextoProduto,
  preencherItensComLinhas,
  preencherItensComTexto,
  similaridadeNomes,
  validarArquivoOrcamento,
} from "@/lib/orcamento-leitura-match";

const PROMPT_EXTRACAO = [
  "Você lê orçamentos, cotações, listas de preços e notas de fornecedores (PDF, imagem ou planilha).",
  "Extraia cada linha de produto com nome limpo, quantidade, unidade, valor unitário, código e marca quando existirem.",
  "Responda SOMENTE um JSON array válido, sem markdown, no formato:",
  '[{"nome":"Resina Autoden Rosa","quantidade":1,"unidade":"kg","valorUnitario":12.5,"codigoBarras":"23198","marca":""}]',
  "Regras:",
  "- nome: SEM números soltos (ex.: 00, 23198), SEM unidade (1KG, UND, UN) e SEM quantidade.",
  "- unidade: use kg, g, ml, l, cx ou un quando aparecer (ex.: 1KG → kg; UND → un).",
  "- quantidade: número da linha (ex.: UND 1 → 1). Padrão 1 se não aparecer.",
  "- codigoBarras: EAN/código/SKU se existir (senão string vazia).",
  "- valorUnitario é número (ponto decimal). Se só houver total e quantidade, calcule o unitário.",
  "- marca: se existir (senão string vazia).",
  "- Ignore totais gerais, frete, impostos e cabeçalhos sem produto.",
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
    const normalizada = normalizarLinhaOrcamentoLida({
      nome,
      valorUnitario,
      quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1,
      codigoBarras: String(r.codigoBarras || r.ean || "").trim() || undefined,
      marca: String(r.marca || "").trim() || undefined,
      unidade: String(r.unidade || r.un || r.und || "").trim() || undefined,
    });
    if (!normalizada.nome || normalizada.nome.length < 2) continue;
    out.push(normalizada);
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

function valorCelulaPlanilha(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw ?? "")
    .replace(/R\$\s?/gi, "")
    .trim();
  if (!s) return 0;
  const limpo = s
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function chaveColunaPlanilha(chave: string) {
  return chave
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/** Lê linhas de Excel/CSV do fornecedor (código, nome, marca, qtd, valor). */
export async function extrairLinhasDePlanilha(
  buffer: ArrayBuffer | Uint8Array | Buffer
): Promise<LinhaOrcamentoLida[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, {
    type: Buffer.isBuffer(buffer) ? "buffer" : "array",
  });
  const nomeAba = wb.SheetNames[0];
  if (!nomeAba) return [];
  const sheet = wb.Sheets[nomeAba];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  const out: LinhaOrcamentoLida[] = [];

  for (const row of rows) {
    const mapa = new Map<string, unknown>();
    for (const [k, v] of Object.entries(row)) {
      mapa.set(chaveColunaPlanilha(k), v);
    }
    const pegar = (...chaves: string[]) => {
      for (const c of chaves) {
        const v = mapa.get(chaveColunaPlanilha(c));
        if (v != null && String(v).trim() !== "") return v;
      }
      return "";
    };

    const nome = String(
      pegar(
        "nome",
        "produto",
        "descricao",
        "desc",
        "item",
        "mercadoria",
        "produto nome",
        "produtonome"
      )
    ).trim();
    const valorUnitario = valorCelulaPlanilha(
      pegar(
        "valorunitario",
        "preco",
        "preco unitario",
        "precounitario",
        "valor",
        "vlrunit",
        "unitario",
        "vlr"
      )
    );
    if (!nome || !(valorUnitario > 0)) continue;

    const quantidadeRaw = valorCelulaPlanilha(
      pegar("quantidade", "qtd", "qtde", "quant", "qty")
    );
    const codigoBarras = String(
      pegar(
        "codigobarras",
        "codigo",
        "cod",
        "ean",
        "sku",
        "referencia",
        "ref",
        "barras"
      )
    ).trim();
    const unidadePlanilha = String(
      pegar("unidade", "un", "und", "unid", "medida")
    ).trim();
    const marca = String(pegar("marca", "fabricante", "brand")).trim();

    out.push(
      normalizarLinhaOrcamentoLida({
        nome,
        valorUnitario,
        quantidade: quantidadeRaw > 0 ? quantidadeRaw : 1,
        codigoBarras: codigoBarras || undefined,
        marca: marca || undefined,
        unidade: unidadePlanilha || undefined,
      })
    );
  }

  return out;
}

function ehPlanilha(mime: string, nomeArquivo?: string) {
  const mimeL = (mime || "").toLowerCase();
  const nome = (nomeArquivo || "").toLowerCase();
  return (
    mimeL.includes("sheet") ||
    mimeL.includes("excel") ||
    mimeL === "text/csv" ||
    /\.(xlsx|xls|csv)$/i.test(nome)
  );
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

  if (ehPlanilha(mime, params.nomeArquivo) && base64) {
    const buffer = Buffer.from(base64, "base64");
    const linhasPlanilha = await extrairLinhasDePlanilha(buffer);
    if (linhasPlanilha.length > 0) {
      return preencherItensComLinhas(itens, linhasPlanilha, "texto");
    }
  }

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
      : file.name.toLowerCase().match(/\.(xlsx|xls|csv)$/)
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "image/jpeg");
  const buffer = await file.arrayBuffer();
  const base64 = toBase64(buffer);

  if (ehPlanilha(mime, file.name)) {
    const linhasPlanilha = await extrairLinhasDePlanilha(buffer);
    if (linhasPlanilha.length > 0) {
      return preencherItensComLinhas(itens, linhasPlanilha, "texto");
    }
  }

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

