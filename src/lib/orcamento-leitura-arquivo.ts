import type { ItemOrcamento } from "@/lib/orcamentos-types";

export type LinhaOrcamentoLida = {
  nome: string;
  quantidade?: number;
  valorUnitario: number;
  codigoBarras?: string;
  marca?: string;
};

export type MatchOrcamentoLeitura = {
  indiceItem: number;
  produtoNomeSistema: string;
  nomeArquivo: string;
  score: number;
  valorUnitario: number;
  quantidade?: number;
};

export type ResultadoLeituraOrcamento = {
  itens: ItemOrcamento[];
  matches: MatchOrcamentoLeitura[];
  naoEncontrados: LinhaOrcamentoLida[];
  fonte: "ia" | "texto" | "misto";
};

const LIMIAR_SIMILARIDADE = 0.35;
const MAX_BYTES = 10 * 1024 * 1024;

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

export function normalizarTextoProduto(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensSignificativos(nome: string) {
  return normalizarTextoProduto(nome)
    .split(" ")
    .filter((t) => t.length > 2 && !/^(de|da|do|das|dos|com|para|sem|und|un|cx|kg|ml|pct)$/.test(t));
}

function distanciaLevenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + custo);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length] as number;
}

function razaoLevenshtein(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const d = distanciaLevenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length);
}

function jaccardTokens(a: string, b: string) {
  const ta = new Set(tokensSignificativos(a));
  const tb = new Set(tokensSignificativos(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

/** Similaridade 0–1 entre nomes de produto (sistema × fornecedor). */
export function similaridadeNomes(nomeA: string, nomeB: string) {
  const a = normalizarTextoProduto(nomeA);
  const b = normalizarTextoProduto(nomeB);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const menor = Math.min(a.length, b.length);
    const maior = Math.max(a.length, b.length);
    return 0.82 + 0.18 * (menor / maior);
  }
  const lev = razaoLevenshtein(a, b);
  const jac = jaccardTokens(a, b);
  return Math.max(lev * 0.55 + jac * 0.45, jac * 0.95, lev * 0.9);
}

function moedaParaNumero(raw: string) {
  const limpo = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

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

/** Heurística: linhas com nome + valor monetário no texto do PDF. */
export function extrairLinhasTextoHeuristico(texto: string): LinhaOrcamentoLida[] {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 4);

  const candidatos: LinhaOrcamentoLida[] = [];
  const reValor =
    /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})\s*$/i;

  for (const linha of linhas) {
    if (/total|subtotal|desconto|frete|imposto|página|page/i.test(linha)) continue;
    const m = linha.match(reValor);
    if (!m?.[1]) continue;
    const valorUnitario = moedaParaNumero(m[1]);
    if (!(valorUnitario > 0)) continue;
    let nome = linha.slice(0, m.index).trim();
    nome = nome
      .replace(/^\d+[\).\-\s]+/, "")
      .replace(/\b\d+([.,]\d+)?\s*(un|und|cx|kg|g|ml|lt|pcs?)?\s*$/i, "")
      .trim();
    if (nome.length < 3) continue;
    const qtdMatch = linha.match(
      /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:un|und|cx|pcs?|qtd|quant)\b/i
    );
    const quantidade = qtdMatch
      ? Number(String(qtdMatch[1]).replace(",", "."))
      : 1;
    candidatos.push({
      nome,
      valorUnitario,
      quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1,
    });
  }

  // Texto colado em uma linha: tenta padrões "NOME ... 12,00"
  if (candidatos.length === 0) {
    const flat = texto.replace(/\s+/g, " ");
    const re =
      /([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\/\-\.%]{2,80}?)\s+(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(flat)) !== null) {
      const nome = m[1].trim();
      const valorUnitario = moedaParaNumero(m[2]);
      if (nome.length < 3 || !(valorUnitario > 0)) continue;
      if (/total|subtotal|desconto|frete/i.test(nome)) continue;
      candidatos.push({ nome, valorUnitario, quantidade: 1 });
    }
  }

  return candidatos;
}

export function casarLinhasComItens(
  itens: ItemOrcamento[],
  linhas: LinhaOrcamentoLida[],
  limiar = LIMIAR_SIMILARIDADE
): ResultadoLeituraOrcamento {
  const atualizados = itens.map((item) => ({ ...item }));
  const usados = new Set<number>();
  const matches: MatchOrcamentoLeitura[] = [];
  const naoEncontrados: LinhaOrcamentoLida[] = [];

  const ordenadas = [...linhas].sort(
    (a, b) => b.valorUnitario - a.valorUnitario
  );

  for (const linha of ordenadas) {
    let melhorIdx = -1;
    let melhorScore = 0;

    const codigoLinha = (linha.codigoBarras || "").replace(/\D/g, "");
    for (let i = 0; i < atualizados.length; i++) {
      if (usados.has(i)) continue;
      const item = atualizados[i]!;
      const codigoItem = (item.codigoBarras || "").replace(/\D/g, "");
      let score = 0;
      if (codigoLinha && codigoItem && codigoLinha === codigoItem) {
        score = 1;
      } else {
        score = similaridadeNomes(item.produtoNome, linha.nome);
        if (item.marca && linha.marca) {
          score = Math.max(
            score,
            similaridadeNomes(
              `${item.produtoNome} ${item.marca}`,
              `${linha.nome} ${linha.marca}`
            )
          );
        }
      }
      if (score > melhorScore) {
        melhorScore = score;
        melhorIdx = i;
      }
    }

    if (melhorIdx < 0 || melhorScore < limiar) {
      naoEncontrados.push(linha);
      continue;
    }

    usados.add(melhorIdx);
    const item = atualizados[melhorIdx]!;
    item.valorUnitario = linha.valorUnitario;
    if (linha.quantidade && linha.quantidade > 0 && item.quantidade <= 0) {
      item.quantidade = linha.quantidade;
    }
    if (linha.marca && !item.marca?.trim()) item.marca = linha.marca;
    if (linha.codigoBarras && !item.codigoBarras?.trim()) {
      item.codigoBarras = linha.codigoBarras;
    }
    matches.push({
      indiceItem: melhorIdx,
      produtoNomeSistema: item.produtoNome,
      nomeArquivo: linha.nome,
      score: melhorScore,
      valorUnitario: linha.valorUnitario,
      quantidade: linha.quantidade,
    });
  }

  return {
    itens: atualizados,
    matches,
    naoEncontrados,
    fonte: "texto",
  };
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
  const parts: Array<Record<string, unknown>> = [
    { text: PROMPT_EXTRACAO },
  ];
  if (textoPdf && textoPdf.trim().length > 40) {
    parts.push({
      text: `Texto extraído do PDF:\n${textoPdf.slice(0, 12000)}`,
    });
  } else {
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

  return chamarOpenAIVisao(mime, base64);
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

export function validarArquivoOrcamento(file: { size: number; type?: string; name?: string }) {
  if (file.size <= 0) return "Arquivo vazio.";
  if (file.size > MAX_BYTES) return "Arquivo muito grande (máx. 10 MB).";
  const mime = (file.type || "").toLowerCase();
  const nome = (file.name || "").toLowerCase();
  const okMime =
    mime === "application/pdf" ||
    mime.startsWith("image/") ||
    nome.endsWith(".pdf") ||
    /\.(png|jpe?g|webp|gif|bmp)$/i.test(nome);
  if (!okMime) return "Envie um PDF ou imagem (JPG, PNG, WEBP).";
  return null;
}

function toBase64(buffer: ArrayBuffer) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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

export function preencherItensComLinhas(
  itens: ItemOrcamento[],
  linhas: LinhaOrcamentoLida[],
  fonte: ResultadoLeituraOrcamento["fonte"] = "texto"
): ResultadoLeituraOrcamento {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error("O orçamento não tem itens para preencher.");
  }
  if (linhas.length === 0) {
    throw new Error(
      "Não foi possível ler produtos no arquivo. Tente um PDF com texto selecionável ou uma imagem mais nítida."
    );
  }
  const resultado = casarLinhasComItens(itens, linhas);
  resultado.fonte = fonte;
  if (resultado.matches.length === 0) {
    throw new Error(
      "Li o arquivo, mas não encontrei nomes parecidos com os produtos deste orçamento. Confira se os itens batem com a cotação."
    );
  }
  return resultado;
}

/** Preenche itens a partir de texto já extraído (ex.: PDF no navegador). */
export function preencherItensComTexto(
  itens: ItemOrcamento[],
  texto: string
): ResultadoLeituraOrcamento {
  const linhas = extrairLinhasTextoHeuristico(texto);
  return preencherItensComLinhas(itens, linhas, "texto");
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
