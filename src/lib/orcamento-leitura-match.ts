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

const LIMIAR_SIMILARIDADE = 0.28;
const MAX_BYTES = 10 * 1024 * 1024;

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
    .filter(
      (t) =>
        t.length > 2 &&
        !/^(de|da|do|das|dos|com|para|sem|und|un|cx|kg|ml|pct|cor|tipo)$/.test(t)
    );
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
  const tokensA = tokensSignificativos(a);
  const tokensB = new Set(tokensSignificativos(b));
  const comuns = tokensA.filter((t) => tokensB.has(t));
  if (comuns.length >= 2) {
    return Math.max(0.55, comuns.length / Math.max(tokensA.length, tokensB.size));
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
        if (item.marca) {
          score = Math.max(
            score,
            similaridadeNomes(
              `${item.produtoNome} ${item.marca}`,
              `${linha.nome} ${linha.marca || ""}`
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

export function validarArquivoOrcamento(file: {
  size: number;
  type?: string;
  name?: string;
}) {
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
