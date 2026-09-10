import type { ItemOrcamento } from "@/lib/orcamentos-types";
import {
  normalizarUnidadeMedida,
  UNIDADE_MEDIDA_PADRAO,
} from "@/lib/unidades-medida";

export type LinhaOrcamentoLida = {
  nome: string;
  quantidade?: number;
  valorUnitario: number;
  codigoBarras?: string;
  marca?: string;
  /** Unidade já normalizada (kg, un, ml…). */
  unidade?: string;
  /** Valor numérico da medida (500 em 500ml, 1 em 1kg). */
  unidadeValor?: number;
};

export type MatchOrcamentoLeitura = {
  indiceItem: number;
  produtoNomeSistema: string;
  nomeArquivo: string;
  score: number;
  valorUnitario: number;
  quantidade?: number;
  /** Atualizou linha existente ou acrescentou produto novo. */
  acao: "atualizado" | "acrescentado";
  renomeou?: boolean;
};

export type ResultadoLeituraOrcamento = {
  itens: ItemOrcamento[];
  matches: MatchOrcamentoLeitura[];
  naoEncontrados: LinhaOrcamentoLida[];
  fonte: "ia" | "texto" | "misto";
  acrescentados: number;
  atualizados: number;
};

/** Score mínimo para considerar o mesmo item do pedido (atualizar). */
const LIMIAR_CASAR = 0.68;
/** Só troca o nome do produto se for claramente o mesmo (variação de grafia). */
const LIMIAR_RENOMEAR = 0.82;
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
    const razao = menor / maior;
    // Inclusão fraca (ex.: "rosa" dentro de nome longo) não conta como mesmo produto.
    if (razao < 0.55) return 0.35 + 0.2 * razao;
    return 0.82 + 0.18 * razao;
  }
  const tokensA = tokensSignificativos(a);
  const tokensB = tokensSignificativos(b);
  const setB = new Set(tokensB);
  const comuns = tokensA.filter((t) => setB.has(t));
  if (comuns.length >= 2) {
    const cobertura =
      comuns.length / Math.max(tokensA.length, tokensB.length, 1);
    // Ex.: só "resina"+"rosa" em nomes com 3–4 tokens distintos → produto diferente.
    if (cobertura <= 0.5) {
      return Math.min(0.48, 0.25 + cobertura);
    }
    return Math.max(0.68, cobertura);
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

function mapearUnidadeCurta(raw: string) {
  const u = raw.toLowerCase().replace(/\./g, "").trim();
  if (u === "lt" || u === "litro" || u === "litros") return "l";
  if (u === "gr" || u === "grama" || u === "gramas") return "g";
  if (u === "und" || u === "unid" || u === "unidade" || u === "pcs" || u === "pc")
    return "un";
  if (u === "kilo" || u === "kilos" || u === "quilograma") return "kg";
  return u;
}

/**
 * Separa do texto bruto: nome limpo (sem números soltos), unidade (kg/und…)
 * e quantidade quando vier como "UND 1".
 */
export function limparDescricaoProdutoArquivo(raw: string): {
  nome: string;
  unidade?: string;
  unidadeValor?: number;
  quantidade?: number;
  codigoBarras?: string;
} {
  let s = String(raw || "").replace(/\s+/g, " ").trim();
  if (!s) return { nome: "" };

  let quantidade: number | undefined;
  let unidadeCurta: string | undefined;
  let unidadeValor: number | undefined;
  let codigoBarras: string | undefined;

  const codRotulo = s.match(
    /(?:cod(?:igo)?(?:\s*de)?\s*barras?|ean|sku|ref\.?)[:\s#]*(\d{6,14})/i
  );
  if (codRotulo?.[1]) {
    codigoBarras = codRotulo[1];
    s = s.replace(codRotulo[0], " ").trim();
  }

  // UND 1 / UN: 1 / QTD 2 — quantidade + unidade unitária
  const undQtd = s.match(
    /\b(?:und|unid|un|qtd|qtde|quant(?:idade)?)\s*[.:]?\s*(\d+(?:[.,]\d+)?)\b/gi
  );
  if (undQtd?.length) {
    const ultimo = undQtd[undQtd.length - 1]!;
    const num = ultimo.match(/(\d+(?:[.,]\d+)?)/);
    if (num) {
      const n = Number(String(num[1]).replace(",", "."));
      if (Number.isFinite(n) && n > 0) quantidade = n;
    }
    if (/\bund|unid|\bun\b/i.test(ultimo) && !unidadeCurta) {
      unidadeCurta = "un";
    }
    for (const m of undQtd) s = s.replace(m, " ");
    s = s.replace(/\s+/g, " ").trim();
  }

  // 1KG / 1 KG / 500 ml / KG — valor da medida + unidade
  const pesoVol = s.match(
    /\b(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|l|lt|cx)\b|\b(kg|g|gr|ml|l|lt|cx)\b/i
  );
  if (pesoVol) {
    const u = mapearUnidadeCurta(pesoVol[2] || pesoVol[3] || "");
    if (u) unidadeCurta = u;
    if (pesoVol[1]) {
      const n = Number(String(pesoVol[1]).replace(",", "."));
      if (Number.isFinite(n) && n > 0) unidadeValor = n;
    }
    s = s.replace(pesoVol[0], " ").replace(/\s+/g, " ").trim();
  }

  // Código numérico solto (ex.: 23198) — guarda se ainda não houver, remove do nome
  const codSolto = s.match(/\b(\d{5,14})\b/);
  if (codSolto?.[1]) {
    if (!codigoBarras) codigoBarras = codSolto[1];
    s = s.replace(codSolto[0], " ").replace(/\s+/g, " ").trim();
  }

  // Remove números restantes do nome (00, 1, etc.) e tokens de unidade órfãos
  s = s
    .replace(/\b\d+([.,]\d+)?\b/g, " ")
    .replace(/\b(kg|g|gr|ml|l|lt|cx|und|unid|un|pcs?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Capitalização leve
  const nome = s
    .split(" ")
    .filter(Boolean)
    .map((p) => {
      if (p.length <= 2) return p.toUpperCase();
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    })
    .join(" ");

  return {
    nome,
    unidade: unidadeCurta
      ? normalizarUnidadeMedida(unidadeCurta)
      : undefined,
    unidadeValor,
    quantidade,
    codigoBarras,
  };
}

/** Normaliza linha lida (IA/PDF/Excel) antes do casamento. */
export function normalizarLinhaOrcamentoLida(
  linha: LinhaOrcamentoLida
): LinhaOrcamentoLida {
  const limpo = limparDescricaoProdutoArquivo(linha.nome);
  const unidade =
    linha.unidade?.trim()
      ? normalizarUnidadeMedida(linha.unidade)
      : limpo.unidade;
  const unidadeValor =
    linha.unidadeValor && linha.unidadeValor > 0
      ? linha.unidadeValor
      : limpo.unidadeValor && limpo.unidadeValor > 0
        ? limpo.unidadeValor
        : undefined;
  return {
    ...linha,
    nome: limpo.nome || linha.nome.trim(),
    unidade: unidade || undefined,
    unidadeValor,
    quantidade:
      linha.quantidade && linha.quantidade > 0
        ? linha.quantidade
        : limpo.quantidade && limpo.quantidade > 0
          ? limpo.quantidade
          : 1,
    codigoBarras:
      (linha.codigoBarras || "").trim() || limpo.codigoBarras || undefined,
    marca: (linha.marca || "").trim() || undefined,
  };
}

function extrairCodigoBarrasLinha(linha: string) {
  const m =
    linha.match(
      /(?:cod(?:igo)?(?:\s*de)?\s*barras?|ean|sku|ref\.?|c[oó]d\.?)[:\s#]*(\d{6,14})/i
    ) || linha.match(/\b(\d{8,14})\b/);
  return m?.[1]?.trim() || undefined;
}

function extrairQuantidadeLinha(linha: string) {
  const limpo = limparDescricaoProdutoArquivo(linha);
  if (limpo.quantidade && limpo.quantidade > 0) return limpo.quantidade;
  const m =
    linha.match(/(?:qtd|qtde|quant(?:idade)?)[:\s]*(\d+(?:[.,]\d+)?)/i) ||
    linha.match(
      /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:un|und|cx|pcs?|kg|g|ml|l|lt|gr)\b/i
    );
  if (!m?.[1]) return undefined;
  const n = Number(String(m[1]).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function extrairMarcaLinha(linha: string) {
  const m = linha.match(
    /(?:marca|fabricante)[:\s]+([A-Za-zÀ-ÿ0-9][\wÀ-ÿ.\-\s]{1,40})/i
  );
  return m?.[1]?.trim() || undefined;
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
    const trechoNome = linha.slice(0, m.index).trim();
    const limpo = limparDescricaoProdutoArquivo(trechoNome);
    const marca = extrairMarcaLinha(linha);
    if (!limpo.nome || limpo.nome.length < 3) continue;
    candidatos.push(
      normalizarLinhaOrcamentoLida({
        nome: limpo.nome,
        valorUnitario,
        quantidade: limpo.quantidade ?? extrairQuantidadeLinha(linha) ?? 1,
        codigoBarras: limpo.codigoBarras || extrairCodigoBarrasLinha(linha),
        marca,
        unidade: limpo.unidade,
      })
    );
  }

  if (candidatos.length === 0) {
    const flat = texto.replace(/\s+/g, " ");
    const re =
      /([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\/\-\.%]{2,80}?)\s+(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(flat)) !== null) {
      const trecho = m[0];
      const limpo = limparDescricaoProdutoArquivo(m[1]);
      const valorUnitario = moedaParaNumero(m[2]);
      if (!limpo.nome || limpo.nome.length < 3 || !(valorUnitario > 0)) continue;
      if (/total|subtotal|desconto|frete/i.test(limpo.nome)) continue;
      candidatos.push(
        normalizarLinhaOrcamentoLida({
          nome: limpo.nome,
          valorUnitario,
          quantidade: limpo.quantidade ?? extrairQuantidadeLinha(trecho) ?? 1,
          codigoBarras: limpo.codigoBarras || extrairCodigoBarrasLinha(trecho),
          marca: extrairMarcaLinha(trecho),
          unidade: limpo.unidade,
        })
      );
    }
  }

  return candidatos;
}

function linhaParaNovoItem(linha: LinhaOrcamentoLida): ItemOrcamento {
  const id = `arquivo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    produtoId: id,
    produtoNome: linha.nome.trim(),
    marca: linha.marca || "",
    codigoBarras: linha.codigoBarras || "",
    unidade: linha.unidade || UNIDADE_MEDIDA_PADRAO,
    unidadeValor:
      linha.unidadeValor && linha.unidadeValor > 0
        ? linha.unidadeValor
        : undefined,
    quantidade:
      linha.quantidade && linha.quantidade > 0 ? linha.quantidade : 1,
    valorUnitario: linha.valorUnitario,
  };
}

export function casarLinhasComItens(
  itens: ItemOrcamento[],
  linhas: LinhaOrcamentoLida[],
  limiar = LIMIAR_CASAR
): ResultadoLeituraOrcamento {
  const atualizados = itens.map((item) => ({ ...item }));
  const usados = new Set<number>();
  const matches: MatchOrcamentoLeitura[] = [];
  const naoEncontrados: LinhaOrcamentoLida[] = [];
  let acrescentados = 0;
  let qtdAtualizados = 0;

  const ordenadas = linhas
    .map(normalizarLinhaOrcamentoLida)
    .filter((l) => l.nome.trim().length >= 2)
    .sort((a, b) => b.valorUnitario - a.valorUnitario);

  for (const linha of ordenadas) {
    let melhorIdx = -1;
    let melhorScore = 0;
    let matchPorCodigo = false;

    const codigoLinha = (linha.codigoBarras || "").replace(/\D/g, "");
    for (let i = 0; i < atualizados.length; i++) {
      if (usados.has(i)) continue;
      const item = atualizados[i]!;
      const codigoItem = (item.codigoBarras || "").replace(/\D/g, "");
      let score = 0;
      let porCodigo = false;
      if (
        codigoLinha &&
        codigoItem &&
        codigoLinha.length >= 5 &&
        codigoLinha === codigoItem
      ) {
        score = 1;
        porCodigo = true;
      } else {
        score = similaridadeNomes(item.produtoNome, linha.nome);
        if (item.marca || linha.marca) {
          score = Math.max(
            score,
            similaridadeNomes(
              `${item.produtoNome} ${item.marca || ""}`,
              `${linha.nome} ${linha.marca || ""}`
            )
          );
        }
      }
      if (score > melhorScore) {
        melhorScore = score;
        melhorIdx = i;
        matchPorCodigo = porCodigo;
      }
    }

    // Produto diferente → nova linha no orçamento (não sobrescreve o cadastrado).
    if (melhorIdx < 0 || (!matchPorCodigo && melhorScore < limiar)) {
      const novo = linhaParaNovoItem(linha);
      const idxNovo = atualizados.length;
      atualizados.push(novo);
      acrescentados += 1;
      matches.push({
        indiceItem: idxNovo,
        produtoNomeSistema: "",
        nomeArquivo: linha.nome,
        score: melhorScore,
        valorUnitario: linha.valorUnitario,
        quantidade: linha.quantidade,
        acao: "acrescentado",
      });
      continue;
    }

    usados.add(melhorIdx);
    const item = atualizados[melhorIdx]!;
    const nomeSistema = item.produtoNome;
    item.valorUnitario = linha.valorUnitario;
    if (linha.quantidade && linha.quantidade > 0) {
      item.quantidade = linha.quantidade;
    }
    if (linha.unidade) item.unidade = linha.unidade;
    if (linha.unidadeValor && linha.unidadeValor > 0) {
      item.unidadeValor = linha.unidadeValor;
    }
    if (linha.codigoBarras?.trim()) {
      item.codigoBarras = linha.codigoBarras.trim();
    }
    if (linha.marca?.trim() && !item.marca?.trim()) {
      item.marca = linha.marca.trim();
    }

    let renomeou = false;
    // Só renomeia se for claramente o mesmo produto (não "resina rosa" genérico).
    if (
      linha.nome?.trim() &&
      (matchPorCodigo || melhorScore >= LIMIAR_RENOMEAR) &&
      similaridadeNomes(nomeSistema, linha.nome) >= LIMIAR_RENOMEAR
    ) {
      item.produtoNome = linha.nome.trim();
      renomeou = true;
    }

    qtdAtualizados += 1;
    matches.push({
      indiceItem: melhorIdx,
      produtoNomeSistema: nomeSistema,
      nomeArquivo: linha.nome,
      score: melhorScore,
      valorUnitario: linha.valorUnitario,
      quantidade: linha.quantidade,
      acao: "atualizado",
      renomeou,
    });
  }

  return {
    itens: atualizados,
    matches,
    naoEncontrados,
    fonte: "texto",
    acrescentados,
    atualizados: qtdAtualizados,
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
    mime.includes("sheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    nome.endsWith(".pdf") ||
    /\.(png|jpe?g|webp|gif|bmp)$/i.test(nome) ||
    /\.(xlsx|xls|csv)$/i.test(nome);
  if (!okMime) {
    return "Envie PDF, imagem (JPG, PNG, WEBP) ou planilha (Excel/CSV).";
  }
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
      "Li o arquivo, mas não consegui aplicar nenhum item ao orçamento."
    );
  }
  return resultado;
}

/** Texto amigável do resultado da leitura do arquivo. */
export function mensagemResultadoLeitura(resultado: ResultadoLeituraOrcamento) {
  const partes: string[] = [];
  if (resultado.atualizados > 0) {
    partes.push(
      `atualizamos ${resultado.atualizados} item(ns) já existentes (preço/qtd/unidade/código)`
    );
  }
  if (resultado.acrescentados > 0) {
    partes.push(
      `acrescentamos ${resultado.acrescentados} produto(s) novo(s) do arquivo`
    );
  }
  if (partes.length === 0) {
    return "Nenhum item foi aplicado. Revise o arquivo.";
  }
  return (
    partes.join("; ") +
    ". Produtos com nome bem diferente viram linha nova (não substituem o cadastrado). Números e 1KG/UND vão para código/unidade, não no nome. Revise antes de enviar."
  );
}

/** Preenche itens a partir de texto já extraído (ex.: PDF no navegador). */
export function preencherItensComTexto(
  itens: ItemOrcamento[],
  texto: string
): ResultadoLeituraOrcamento {
  const linhas = extrairLinhasTextoHeuristico(texto);
  return preencherItensComLinhas(itens, linhas, "texto");
}
