import type { ItemOrcamento } from "@/lib/orcamentos-types";
import {
  anexarFreteDoTexto,
  anexarPagamentoDoTexto,
  deduplicarLinhasProduto,
  extrairCondicaoPagamentoDoTexto,
  extrairFreteDoTexto,
  extrairLinhasTextoHeuristico,
  linhaPareceProdutoValido,
  normalizarLinhaOrcamentoLida,
  normalizarTextoProduto,
  preencherItensComLinhas,
  validarArquivoOrcamento,
  type CondicaoPagamentoLida,
  type LinhaOrcamentoLida,
  type ResultadoLeituraOrcamento,
} from "@/lib/orcamento-leitura-match";

export type {
  LinhaOrcamentoLida,
  MatchOrcamentoLeitura,
  ResultadoLeituraOrcamento,
} from "@/lib/orcamento-leitura-match";

export {
  anexarFreteDoTexto,
  anexarPagamentoDoTexto,
  casarLinhasComItens,
  contarCodigosProdutoNoTexto,
  deduplicarLinhasProduto,
  extrairCondicaoPagamentoDoTexto,
  extrairFreteDoTexto,
  fretePlausivel,
  extrairLinhasTabelaFornecedor,
  extrairLinhasTextoHeuristico,
  limparDescricaoProdutoArquivo,
  linhaPareceProdutoValido,
  mensagemResultadoLeitura,
  normalizarLinhaOrcamentoLida,
  normalizarTextoProduto,
  preencherItensComLinhas,
  preencherItensComTexto,
  similaridadeNomes,
  validarArquivoOrcamento,
} from "@/lib/orcamento-leitura-match";

export type { CondicaoPagamentoLida } from "@/lib/orcamento-leitura-match";

const PROMPT_EXTRACAO = [
  "Você lê orçamentos/cotações de fornecedores odontológicos (PDF ou imagem).",
  "Formato típico da tabela: CODIGO | DESCRICAO | UND (UND/UN/CXA) | QNTDE | VLR.UNIT | VALOR TOTAL",
  "Responda SOMENTE um JSON válido, sem markdown, neste formato:",
  '{"itens":[{"nome":"Resina Triunfo Auto Liq","quantidade":1,"unidadeValor":1000,"unidade":"ml","valorUnitario":125,"codigoBarras":"22094","marca":"Triunfo"}],"frete":30,"pagamento":{"forma":"boleto","parcelas":4}}',
  "Regras dos ITENS (array itens):",
  "- Extraia TODAS as linhas de produto da tabela (código + descrição + valor).",
  "- IGNORE cabeçalho, cliente, totais, vendedor, nomes de pessoa e linhas de parcela (datas R$).",
  "- codigoBarras = coluna CODIGO; quantidade = QNTDE; valorUnitario = VLR.UNIT (número com ponto).",
  "- Se a descrição tiver kg/g/ml/L, preencha unidade e unidadeValor.",
  "- Use a DESCRICAO completa do produto (não invente nomes curtos).",
  "Regras do FRETE (campo frete, número):",
  "- Formato Dental Protetic (linha de totais): 'Total Bruto --> 683,88    Frete --> 30,00    Descontos --> 0,00    Total Geral --> 713,88'.",
  "- O frete é SOMENTE o número IMEDIATAMENTE após a palavra Frete (com --> ou :). No exemplo, frete=30 (NÃO 683.88 nem 713.88).",
  "- Procure também: Fretes, Transporte, Despacho, CIF, FOB, Shipping, Taxa/Custo de entrega.",
  "- NUNCA use Total Bruto, Total Geral, subtotal ou soma dos produtos como frete.",
  "- Se não houver frete escrito, use 0. NÃO invente. NÃO coloque frete como item de produto.",
  "Regras do PAGAMENTO (objeto pagamento):",
  "- forma: a_vista | pix | cartao_credito | boleto",
  "- parcelas: número de 1 a 12",
  "- Exemplos: '4X BOLETO' ou 'Condição de Pagamento: 4X BOLETO' → {\"forma\":\"boleto\",\"parcelas\":4}",
  "- 'Boleto 1X' / '1X BOLETO' → boleto 1; '3x cartão' / 'CARTAO 6X' → cartao_credito com N parcelas",
  "- 'PIX' → pix 1; 'À vista' → a_vista 1",
  "- Se listar várias datas de vencimento (parcela 1/2/3/4) e mencionar boleto, use a quantidade de parcelas.",
  "- Se não houver condição clara, omita pagamento ou use null.",
].join("\n");

type ExtracaoIa = {
  linhas: LinhaOrcamentoLida[];
  frete: number;
  pagamento: CondicaoPagamentoLida | null;
  textoBruto: string;
};

function linhasDeArrayJson(parsed: unknown): LinhaOrcamentoLida[] {
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
      unidadeValor: Number(r.unidadeValor ?? r.medida ?? r.conteudo ?? 0) || undefined,
    });
    if (!normalizada.nome || normalizada.nome.length < 2) continue;
    if (!linhaPareceProdutoValido(normalizada)) continue;
    out.push(normalizada);
  }
  return out;
}

function parseJsonExtracao(texto: string): ExtracaoIa {
  const limpo = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let linhas: LinhaOrcamentoLida[] = [];
  let frete = 0;
  let pagamento: CondicaoPagamentoLida | null = null;

  const normalizarPagamentoIa = (
    raw: unknown
  ): CondicaoPagamentoLida | null => {
    if (!raw || typeof raw !== "object") return null;
    const p = raw as Record<string, unknown>;
    const formaRaw = String(p.forma || p.tipo || p.meio || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    let forma: CondicaoPagamentoLida["forma"] | null = null;
    if (formaRaw.includes("boleto")) forma = "boleto";
    else if (formaRaw.includes("cartao") || formaRaw.includes("credito"))
      forma = "cartao_credito";
    else if (formaRaw.includes("pix")) forma = "pix";
    else if (formaRaw.includes("vista")) forma = "a_vista";
    if (!forma) return null;
    const parcelasNum = Number(p.parcelas ?? p.qtd ?? p.vezes ?? 1);
    const parcelas = Number.isFinite(parcelasNum)
      ? Math.min(12, Math.max(1, Math.round(parcelasNum)))
      : 1;
    return {
      forma,
      parcelas: forma === "boleto" || forma === "cartao_credito" ? parcelas : 1,
    };
  };

  const inicioObj = limpo.indexOf("{");
  const fimObj = limpo.lastIndexOf("}");
  if (inicioObj >= 0 && fimObj > inicioObj) {
    try {
      const obj = JSON.parse(limpo.slice(inicioObj, fimObj + 1)) as Record<
        string,
        unknown
      >;
      const itensRaw = obj.itens ?? obj.items ?? obj.produtos ?? obj.linhas;
      linhas = linhasDeArrayJson(itensRaw);
      const freteRaw = obj.frete ?? obj.Frete ?? obj.transporte ?? obj.shipping;
      if (typeof freteRaw === "number" && freteRaw > 0) frete = freteRaw;
      else if (typeof freteRaw === "string") {
        const n = Number(
          String(freteRaw)
            .replace(/[^\d,.-]/g, "")
            .replace(/\.(?=\d{3}(?:\D|$))/g, "")
            .replace(",", ".")
        );
        if (Number.isFinite(n) && n > 0) frete = n;
      }
      pagamento = normalizarPagamentoIa(
        obj.pagamento ?? obj.condicaoPagamento ?? obj.pagamentoCondicao
      );
    } catch {
      /* tenta array abaixo */
    }
  }

  if (linhas.length === 0) {
    const inicio = limpo.indexOf("[");
    const fim = limpo.lastIndexOf("]");
    if (inicio >= 0 && fim > inicio) {
      try {
        linhas = linhasDeArrayJson(JSON.parse(limpo.slice(inicio, fim + 1)));
      } catch {
        linhas = [];
      }
    }
  }

  if (!(frete > 0)) {
    frete = extrairFreteDoTexto(limpo);
  }
  if (!pagamento) {
    pagamento = extrairCondicaoPagamentoDoTexto(limpo);
  }

  return { linhas, frete, pagamento, textoBruto: limpo };
}

async function chamarGeminiPartes(
  parts: Array<Record<string, unknown>>
): Promise<ExtracaoIa | null> {
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
          maxOutputTokens: 8192,
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
    const extracao = parseJsonExtracao(texto);
    return extracao.linhas.length > 0 ||
      extracao.frete > 0 ||
      Boolean(extracao.pagamento)
      ? extracao
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function chamarOpenAIVisao(
  mime: string,
  base64: string
): Promise<ExtracaoIa | null> {
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
              {
                type: "text",
                text: "Extraia os itens, o frete e a condição de pagamento (ex.: 4X BOLETO) deste documento.",
              },
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
    const extracao = parseJsonExtracao(texto);
    return extracao.linhas.length > 0 ||
      extracao.frete > 0 ||
      Boolean(extracao.pagamento)
      ? extracao
      : null;
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
): Promise<ExtracaoIa | null> {
  const parts: Array<Record<string, unknown>> = [{ text: PROMPT_EXTRACAO }];
  if (textoPdf && textoPdf.trim().length > 40) {
    parts.push({
      text: `Texto extraído do PDF (use para Frete no rodapé e Condição de Pagamento, ex.: 4X BOLETO):\n${textoPdf.slice(0, 50000)}`,
    });
  } else if (base64) {
    parts.push({
      inline_data: { mime_type: mime, data: base64 },
    });
  }

  const gemini = await chamarGeminiPartes(parts);
  if (
    gemini &&
    (gemini.linhas.length > 0 || gemini.frete > 0 || gemini.pagamento)
  ) {
    return gemini;
  }

  if (textoPdf && textoPdf.trim().length > 40) {
    const geminiTexto = await chamarGeminiPartes([
      {
        text: `${PROMPT_EXTRACAO}\n\nTexto:\n${textoPdf.slice(0, 50000)}`,
      },
    ]);
    if (
      geminiTexto &&
      (geminiTexto.linhas.length > 0 ||
        geminiTexto.frete > 0 ||
        geminiTexto.pagamento)
    ) {
      return geminiTexto;
    }
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
      type ItemTxt = { str: string; x: number; y: number };
      const itens: ItemTxt[] = [];
      for (const raw of content.items) {
        if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
        const str = String((raw as { str?: string }).str || "").trim();
        if (!str) continue;
        const tr = (raw as { transform?: number[] }).transform;
        const x = Array.isArray(tr) ? Number(tr[4] ?? 0) : 0;
        const y = Array.isArray(tr) ? Number(tr[5] ?? 0) : 0;
        itens.push({ str, x, y });
      }
      itens.sort((a, b) => b.y - a.y || a.x - b.x);
      const linhas: string[] = [];
      let linhaAtual: ItemTxt[] = [];
      let yRef: number | null = null;
      for (const item of itens) {
        if (yRef == null || Math.abs(item.y - yRef) <= 3) {
          linhaAtual.push(item);
          yRef = yRef == null ? item.y : (yRef + item.y) / 2;
        } else {
          linhaAtual.sort((a, b) => a.x - b.x);
          linhas.push(linhaAtual.map((i) => i.str).join(" "));
          linhaAtual = [item];
          yRef = item.y;
        }
      }
      if (linhaAtual.length > 0) {
        linhaAtual.sort((a, b) => a.x - b.x);
        linhas.push(linhaAtual.map((i) => i.str).join(" "));
      }
      partes.push(linhas.join("\n"));
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
    const unidadeValorRaw = valorCelulaPlanilha(
      pegar("unidadevalor", "medida", "conteudo", "tamanho", "peso", "volume")
    );
    const marca = String(pegar("marca", "fabricante", "brand")).trim();

    out.push(
      normalizarLinhaOrcamentoLida({
        nome,
        valorUnitario,
        quantidade: quantidadeRaw > 0 ? quantidadeRaw : 1,
        codigoBarras: codigoBarras || undefined,
        marca: marca || undefined,
        unidade: unidadePlanilha || undefined,
        unidadeValor: unidadeValorRaw > 0 ? unidadeValorRaw : undefined,
      })
    );
  }

  return out.filter(linhaPareceProdutoValido);
}

/** Lê frete de células soltas na planilha (ex.: linha "Frete" / "30,00"). */
export async function extrairFreteDePlanilha(
  buffer: ArrayBuffer | Uint8Array | Buffer
): Promise<number> {
  try {
    const texto = await textoPlanilhaParaMeta(buffer);
    return extrairFreteDoTexto(texto);
  } catch {
    return 0;
  }
}

async function textoPlanilhaParaMeta(
  buffer: ArrayBuffer | Uint8Array | Buffer
): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, {
      type: Buffer.isBuffer(buffer) ? "buffer" : "array",
    });
    const nomeAba = wb.SheetNames[0];
    if (!nomeAba) return "";
    const sheet = wb.Sheets[nomeAba];
    if (!sheet) return "";
    return XLSX.utils.sheet_to_csv(sheet);
  } catch {
    return "";
  }
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
  ia: ExtracaoIa | null,
  heuristicas: LinhaOrcamentoLida[]
): {
  linhas: LinhaOrcamentoLida[];
  fonte: ResultadoLeituraOrcamento["fonte"];
  freteIa: number;
  pagamentoIa: CondicaoPagamentoLida | null;
} {
  const h = deduplicarLinhasProduto(heuristicas);
  const a = ia ? deduplicarLinhasProduto(ia.linhas) : [];
  const freteIa = ia?.frete ?? 0;
  const pagamentoIa = ia?.pagamento ?? null;

  // Tabela CODIGO+DESCRICAO do PDF é mais confiável que a IA (evita "Liquido Cx").
  const heuristicasComCodigo = h.filter(
    (l) => (l.codigoBarras || "").replace(/\D/g, "").length >= 4
  );
  if (heuristicasComCodigo.length >= 2) {
    return {
      linhas: heuristicasComCodigo,
      fonte: a.length > 0 ? "misto" : "texto",
      freteIa,
      pagamentoIa,
    };
  }

  if (a.length > 0 && h.length > a.length * 1.5) {
    const mapa = new Map<string, LinhaOrcamentoLida>();
    for (const l of [...a, ...h]) {
      if (!linhaPareceProdutoValido(l)) continue;
      const k = normalizarTextoProduto(l.nome);
      if (!k) continue;
      if (!mapa.has(k)) mapa.set(k, l);
    }
    return {
      linhas: deduplicarLinhasProduto([...mapa.values()]),
      fonte: "misto",
      freteIa,
      pagamentoIa,
    };
  }
  if (a.length > 0) {
    return {
      linhas: a,
      fonte: h.length > 0 ? "misto" : "ia",
      freteIa,
      pagamentoIa,
    };
  }
  return { linhas: h, fonte: "texto", freteIa, pagamentoIa };
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
      const fretePlanilha = await extrairFreteDePlanilha(buffer);
      const textoPlanilha = await textoPlanilhaParaMeta(buffer);
      const resultado = preencherItensComLinhas(itens, linhasPlanilha, "texto");
      return anexarPagamentoDoTexto(
        anexarFreteDoTexto(resultado, textoPlanilha, fretePlanilha),
        textoPlanilha
      );
    }
  }

  const heuristicas = textoPdf ? extrairLinhasTextoHeuristico(textoPdf) : [];
  const ia =
    base64 || textoPdf.length > 40
      ? await extrairLinhasComIa(mime || "text/plain", base64, textoPdf)
      : null;

  const { linhas, fonte, freteIa, pagamentoIa } = consolidarLinhas(
    ia,
    heuristicas
  );
  const textoMeta = [textoPdf, ia?.textoBruto || ""].filter(Boolean).join("\n");
  return anexarPagamentoDoTexto(
    anexarFreteDoTexto(
      preencherItensComLinhas(itens, linhas, fonte),
      textoMeta,
      freteIa
    ),
    textoMeta,
    pagamentoIa
  );
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
      const fretePlanilha = await extrairFreteDePlanilha(buffer);
      const textoPlanilha = await textoPlanilhaParaMeta(buffer);
      const resultado = preencherItensComLinhas(itens, linhasPlanilha, "texto");
      return anexarPagamentoDoTexto(
        anexarFreteDoTexto(resultado, textoPlanilha, fretePlanilha),
        textoPlanilha
      );
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

