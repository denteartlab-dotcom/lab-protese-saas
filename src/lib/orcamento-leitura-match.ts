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

/** Texto que não é linha de produto (pagamento, cabeçalho, lixo do PDF). */
const RE_LIXO_LINHA =
  /\b(boleto|pix|cart[aã]o|parcela|parcelado|a\s*vista|desconto|frete|total|subtotal|imposto|condi[cç][oõ]es?|pagamento|vendedor|representante|cliente|pedido|obrigad|assinatura|banco|ag[eê]ncia|vencimento|observa[cç][aã]o|telefone|email|e-mail|whatsapp|endere[cç]o|cnpj|cpf|ie\b|página|page|fornecedor)\b|\d+\s*x\s*(boleto|parcela|vezes)?|\bx\s*boleto\b/i;

/** Sinais comuns de produto laboratorial / material. */
const RE_SINAL_PRODUTO =
  /\b(resina|cera|l[ií]quido|liq|acr[ií]lico|gesso|silicone|alginato|broca|disco|pasta|cimento|porcelana|zirc[oô]nio|metal|liga|fio|autoden|create|evoden|lysanda|lys|rolette|rolete|monomer|pol[ií]mero|espa[cç]ador|isolante|goma|opaco|glaze|dentina|esmalte|revestimento|triunfo|wilson|heat|shock|enceramento|l[aâ]minas?|env)\b/i;

const MARCAS_DISTINTIVAS = [
  "autoden",
  "create",
  "triunfo",
  "wilson",
  "lysanda",
  "evoden",
  "heat",
];

/**
 * Aceita só linhas de produto com valor (e nome/código válidos).
 * Descarta boleto, nomes de pessoa, “/ /”, cabeçalhos etc.
 */
export function linhaPareceProdutoValido(linha: LinhaOrcamentoLida): boolean {
  if (!(linha.valorUnitario > 0)) return false;

  const nomeBruto = String(linha.nome || "").trim();
  if (!nomeBruto || nomeBruto.length < 3) return false;

  const alfanum = nomeBruto.replace(/[^A-Za-zÀ-ÿ0-9]/g, "");
  if (alfanum.length < 3) return false;

  // Só barras / pontuação (ex.: "/ /")
  if (/^[\s\/\-|_.]+$/.test(nomeBruto)) return false;

  if (RE_LIXO_LINHA.test(nomeBruto)) return false;

  const tokens = tokensSignificativos(nomeBruto);
  if (tokens.length === 0) return false;

  const codigo = (linha.codigoBarras || "").replace(/\D/g, "");
  const temCodigo = codigo.length >= 4;
  const temUnidade = Boolean(linha.unidade || (linha.unidadeValor && linha.unidadeValor > 0));
  const temSinalProduto = RE_SINAL_PRODUTO.test(nomeBruto);

  // Código do fornecedor + valor → sempre produto (sem limite artificial)
  if (temCodigo && tokens.length >= 1 && linha.valorUnitario > 0) return true;

  // Nome de material + preço
  if (temSinalProduto && tokens.length >= 1) return true;

  // Pelo menos 2 tokens significativos + unidade/medida ou preço plausível de item
  if (tokens.length >= 2 && (temUnidade || linha.valorUnitario >= 1)) {
    // Evita "Nome Sobrenome" sem sinal de produto/código
    const pareceNomePessoa =
      tokens.length <= 3 &&
      tokens.every((t) => /^[a-záàâãéêíóôõúç]+$/i.test(t)) &&
      !temSinalProduto &&
      !temCodigo &&
      !temUnidade;
    if (pareceNomePessoa) return false;
    return true;
  }

  return false;
}

/** Remove duplicatas (mesmo código ou mesmo nome+valor). */
export function deduplicarLinhasProduto(
  linhas: LinhaOrcamentoLida[]
): LinhaOrcamentoLida[] {
  const vistas = new Set<string>();
  const out: LinhaOrcamentoLida[] = [];
  for (const linha of linhas) {
    if (!linhaPareceProdutoValido(linha)) continue;
    const cod = (linha.codigoBarras || "").replace(/\D/g, "");
    const chave =
      cod.length >= 4
        ? `c:${cod}`
        : `n:${normalizarTextoProduto(linha.nome)}|v:${linha.valorUnitario.toFixed(2)}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    out.push(linha);
  }
  return out;
}

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

  const marcasA = MARCAS_DISTINTIVAS.filter((m) => a.includes(m));
  const marcasB = MARCAS_DISTINTIVAS.filter((m) => b.includes(m));
  if (
    marcasA.length > 0 &&
    marcasB.length > 0 &&
    !marcasA.some((m) => marcasB.includes(m))
  ) {
    // Ex.: Resina Create ≠ Resina Autoden / Triunfo
    return Math.min(0.35, jaccardTokens(a, b) * 0.5);
  }

  if (a.includes(b) || b.includes(a)) {
    const menor = Math.min(a.length, b.length);
    const maior = Math.max(a.length, b.length);
    const razao = menor / maior;
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
  if (
    u === "und" ||
    u === "unid" ||
    u === "unidade" ||
    u === "pcs" ||
    u === "pc"
  ) {
    return "un";
  }
  if (u === "cxa" || u === "caixa") return "cx";
  if (u === "kilo" || u === "kilos" || u === "quilograma") return "kg";
  return u;
}

function capitalizarNomeProduto(s: string) {
  return s
    .split(" ")
    .filter(Boolean)
    .map((p) => {
      const lower = p.toLowerCase();
      // Mantém abreviações comuns do fornecedor
      if (/^(liq|r|auto|env)$/i.test(lower)) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      if (p.length <= 2 && !/^\d+$/.test(p)) return p.toUpperCase();
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Separa do texto bruto: nome limpo, medida (1000ml / 1kg) e código.
 * Não remove abreviações do produto (ex.: LIQ. em "Resina Triunfo Auto Liq").
 */
export function limparDescricaoProdutoArquivo(raw: string): {
  nome: string;
  unidade?: string;
  unidadeValor?: number;
  quantidade?: number;
  codigoBarras?: string;
} {
  let s = String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/LIQ\./gi, "LIQ ")
    .trim();
  if (!s) return { nome: "" };

  let quantidade: number | undefined;
  let unidadeCurta: string | undefined;
  let unidadeValor: number | undefined;
  let codigoBarras: string | undefined;

  const codRotulo = s.match(
    /(?:cod(?:igo)?(?:\s*de)?\s*barras?|ean|sku|ref\.?)[:\s#]*(\d{4,14})/i
  );
  if (codRotulo?.[1]) {
    codigoBarras = codRotulo[1];
    s = s.replace(codRotulo[0], " ").trim();
  }

  // Coluna UND/CXA + quantidade no final da descrição (quando veio colado)
  const undFinal = s.match(
    /\s+(UND|UNID|UN|CXA|CX)\s+(\d+(?:[.,]\d+)?)\s*$/i
  );
  if (undFinal) {
    const n = Number(String(undFinal[2]).replace(",", "."));
    if (Number.isFinite(n) && n > 0) quantidade = n;
    // UND/CXA = embalagem; medida (kg/ml) tem prioridade se existir na descrição
    const emb = mapearUnidadeCurta(undFinal[1] || "");
    if (emb && !unidadeCurta) unidadeCurta = emb;
    s = s.slice(0, undFinal.index).trim();
  }

  // Medidas coladas ou com espaço: 1000ML, 1KG, 200G, 225GR, 1 KG
  const medidas: RegExpMatchArray[] = [];
  const reMedida =
    /(\d+(?:[.,]\d+)?)\s*(kg|gr|ml|lt|g|l)\b|(\d+(?:[.,]\d+)?)(kg|gr|ml|lt|g|l)\b/gi;
  let mMed: RegExpExecArray | null;
  while ((mMed = reMedida.exec(s)) !== null) {
    medidas.push(mMed);
  }
  if (medidas.length > 0) {
    const ultimo = medidas[medidas.length - 1]!;
    const numRaw = ultimo[1] || ultimo[3] || "";
    const undRaw = ultimo[2] || ultimo[4] || "";
    const u = mapearUnidadeCurta(undRaw);
    if (u) unidadeCurta = u; // kg/ml sobrescreve UND/CXA da embalagem
    const n = Number(String(numRaw).replace(",", "."));
    if (Number.isFinite(n) && n > 0) unidadeValor = n;
    for (const m of medidas) {
      s = s.replace(m[0], " ");
    }
    s = s.replace(/\s+/g, " ").trim();
  }

  // Código no início (4–6 dígitos típicos de fornecedor)
  const codInicio = s.match(/^(\d{4,6})\s+/);
  if (codInicio?.[1]) {
    if (!codigoBarras) codigoBarras = codInicio[1];
    s = s.slice(codInicio[0].length).trim();
  } else {
    const codSolto = s.match(/\b(\d{5,14})\b/);
    if (codSolto?.[1]) {
      if (!codigoBarras) codigoBarras = codSolto[1];
      s = s.replace(codSolto[0], " ").replace(/\s+/g, " ").trim();
    }
  }

  // Remove embalagem órfã e números de envase (12ENV), mantém variantes curtas (Rosa 7 / Rosa 9)
  s = s
    .replace(/\(\s*lata\s*\)/gi, " ")
    .replace(/\b\d+\s*env\b/gi, " ")
    .replace(/\b(und|unid|un|cxa|cx|pcs?)\b/gi, " ")
    .replace(/\s*[+|/]+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Não apaga números de 1–2 dígitos (ex.: Cera Rosa 7); remove só números longos restantes
  s = s.replace(/\b\d{3,}\b/g, " ").replace(/\s+/g, " ").trim();

  const nome = capitalizarNomeProduto(s);

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

/**
 * Formato típico de orçamento de fornecedor (Dental Protetic e similares):
 * CODIGO | DESCRICAO | UND/CXA | QNTDE | VLR.UNIT | VALOR TOTAL
 */
export function extrairLinhasTabelaFornecedor(
  texto: string
): LinhaOrcamentoLida[] {
  const flat = String(texto || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ");
  const linhasBrutas = flat
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 8);

  const porCodigo = new Map<string, LinhaOrcamentoLida>();

  function registrar(raw: {
    codigo: string;
    descricao: string;
    undColuna: string;
    qtd: number;
    valorUnitario: number;
  }) {
    const { codigo, descricao, undColuna, qtd, valorUnitario } = raw;
    if (!(valorUnitario > 0) || !descricao.trim()) return;
    if (
      /total\s*(bruto|geral)|frete|desconto|boleto|vendedor|cliente|pagamento|orçamento|codigo\s+descricao/i.test(
        descricao
      )
    ) {
      return;
    }
    const limpo = limparDescricaoProdutoArquivo(descricao);
    const unidade = limpo.unidade || normalizarUnidadeMedida(undColuna);
    const nome = limpo.nome || capitalizarNomeProduto(descricao);
    if (!nome || nome.length < 3) return;

    const linha: LinhaOrcamentoLida = {
      nome,
      codigoBarras: codigo,
      quantidade: Number.isFinite(qtd) && qtd > 0 ? qtd : 1,
      valorUnitario,
      unidade,
      unidadeValor: limpo.unidadeValor,
      marca: descricao.match(
        /\b(lysanda|wilson|autoden|triunfo|evoden|create)\b/i
      )?.[1],
    };
    const chave = codigo.replace(/\D/g, "") || normalizarTextoProduto(nome);
    const atual = porCodigo.get(chave);
    // Prefere nome mais completo se houver duplicata
    if (!atual || (linha.nome?.length || 0) > (atual.nome?.length || 0)) {
      porCodigo.set(chave, linha);
    }
  }

  const reLinha =
    /^(\d{4,6})\s+(.+?)\s+(UND|UNID|UN|CXA|CX)\s+(\d+(?:[.,]\d+)?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+(\d{1,3}(?:\.\d{3})*,\d{2}))?\s*$/i;

  for (const linha of linhasBrutas) {
    if (
      /total\s*(bruto|geral)|frete|desconto|boleto|vendedor|cliente|pagamento|orçamento|codigo\s+descricao/i.test(
        linha
      )
    ) {
      continue;
    }
    const m = linha.match(reLinha);
    if (!m) continue;
    registrar({
      codigo: m[1]!,
      descricao: m[2]!.trim(),
      undColuna: mapearUnidadeCurta(m[3]!),
      qtd: Number(String(m[4]).replace(",", ".")),
      valorUnitario: moedaParaNumero(m[5]!),
    });
  }

  // Sempre tenta também no texto contínuo (PDF costuma quebrar linhas).
  const textoContinuo = flat.replace(/\n/g, " ");
  const reGlobal =
    /(\d{4,6})\s+([A-ZÀ-Ÿa-zà-ÿ0-9][A-ZÀ-Ÿa-zà-ÿ0-9\s\.\,\-\/\+\(\)]{3,120}?)\s+(UND|UNID|UN|CXA|CX)\s+(\d+(?:[.,]\d+)?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+(\d{1,3}(?:\.\d{3})*,\d{2}))?/gi;
  let m: RegExpExecArray | null;
  while ((m = reGlobal.exec(textoContinuo)) !== null) {
    registrar({
      codigo: m[1]!,
      descricao: m[2]!.trim(),
      undColuna: mapearUnidadeCurta(m[3]!),
      qtd: Number(String(m[4]).replace(",", ".")),
      valorUnitario: moedaParaNumero(m[5]!),
    });
  }

  // Padrão alternativo: código + descrição + valor (sem UND explícito no meio)
  if (porCodigo.size === 0) {
    const reAlt =
      /(\d{4,6})\s+([A-ZÀ-Ÿa-zà-ÿ][A-ZÀ-Ÿa-zà-ÿ0-9\s\.\,\-\/\+\(\)]{4,100}?)\s+(\d+(?:[.,]\d+)?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
    while ((m = reAlt.exec(textoContinuo)) !== null) {
      const qtdRaw = Number(String(m[3]).replace(",", "."));
      // qtd costuma ser inteiro pequeno; se vier preço, ignora
      const qtd = qtdRaw > 0 && qtdRaw <= 999 ? qtdRaw : 1;
      registrar({
        codigo: m[1]!,
        descricao: m[2]!.trim(),
        undColuna: "un",
        qtd,
        valorUnitario: moedaParaNumero(m[4]!),
      });
    }
  }

  return deduplicarLinhasProduto(
    [...porCodigo.values()].map((c) => normalizarLinhaOrcamentoLida(c))
  );
}

/** Conta códigos de produto no texto do PDF (para saber se a leitura ficou incompleta). */
export function contarCodigosProdutoNoTexto(texto: string) {
  const matches = String(texto || "").match(
    /(?:^|\s)(\d{4,6})\s+[A-Za-zÀ-ÿ]/gm
  );
  if (!matches) return 0;
  return new Set(
    matches.map((m) => m.trim().replace(/\s.*/, "").replace(/\D/g, ""))
  ).size;
}

/** Normaliza linha lida (IA/PDF/Excel) antes do casamento. */
export function normalizarLinhaOrcamentoLida(
  linha: LinhaOrcamentoLida
): LinhaOrcamentoLida {
  const limpo = limparDescricaoProdutoArquivo(linha.nome);
  const undLinha = linha.unidade?.trim()
    ? normalizarUnidadeMedida(linha.unidade)
    : undefined;
  const undLimpo = limpo.unidade;
  const ehPesoVol = (u?: string) =>
    !!u && /^(kg|g|ml|l|m)\b/i.test(u.split("(")[0]?.trim() || u);

  // 1000ml / 1kg da descrição ganha de UND/CXA da coluna
  let unidade = undLinha;
  if (undLimpo && ehPesoVol(undLimpo) && !ehPesoVol(undLinha)) {
    unidade = undLimpo;
  } else if (!unidade) {
    unidade = undLimpo;
  }

  const unidadeValor =
    linha.unidadeValor && linha.unidadeValor > 0
      ? linha.unidadeValor
      : limpo.unidadeValor && limpo.unidadeValor > 0
        ? limpo.unidadeValor
        : undefined;

  // Prefere nome já limpo da tabela; se a limpeza destruiu demais, mantém o original
  let nome = limpo.nome || linha.nome.trim();
  if (
    limpo.nome &&
    linha.nome.trim().length > limpo.nome.length + 8 &&
    tokensSignificativos(limpo.nome).length < 2 &&
    tokensSignificativos(linha.nome).length >= 2
  ) {
    nome = capitalizarNomeProduto(
      limparDescricaoProdutoArquivo(linha.nome).nome || linha.nome
    );
  }

  return {
    ...linha,
    nome,
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
  // Formato tabular de fornecedor (CODIGO + DESCRICAO + UND + QTD + VLR)
  const tabela = extrairLinhasTabelaFornecedor(texto);
  if (tabela.length > 0) return tabela;

  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 4);

  const candidatos: LinhaOrcamentoLida[] = [];
  const reValor =
    /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})\s*$/i;

  for (const linha of linhas) {
    if (/total|subtotal|desconto|frete|imposto|página|page|boleto|vendedor/i.test(linha))
      continue;
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
        unidadeValor: limpo.unidadeValor,
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
      if (/total|subtotal|desconto|frete|boleto/i.test(limpo.nome)) continue;
      candidatos.push(
        normalizarLinhaOrcamentoLida({
          nome: limpo.nome,
          valorUnitario,
          quantidade: limpo.quantidade ?? extrairQuantidadeLinha(trecho) ?? 1,
          codigoBarras: limpo.codigoBarras || extrairCodigoBarrasLinha(trecho),
          marca: extrairMarcaLinha(trecho),
          unidade: limpo.unidade,
          unidadeValor: limpo.unidadeValor,
        })
      );
    }
  }

  return candidatos.filter(linhaPareceProdutoValido);
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

  const ordenadas = deduplicarLinhasProduto(
    linhas.map(normalizarLinhaOrcamentoLida)
  ).sort((a, b) => b.valorUnitario - a.valorUnitario);

  for (const linha of ordenadas) {
    if (!linhaPareceProdutoValido(linha)) {
      naoEncontrados.push(linha);
      continue;
    }

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
        codigoLinha.length >= 4 &&
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

    // Produto diferente e válido → nova linha; lixo já foi filtrado acima.
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
      "Li o arquivo, mas não encontrei linhas de produto válidas (nome + valor). Ignorei boletos, nomes e outros textos."
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
    ". Todos os produtos válidos do arquivo foram incluídos (sem limite). Revise antes de enviar."
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
