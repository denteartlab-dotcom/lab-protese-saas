/** Metadados de despesa embutidos na descrição (Contas a Pagar). */
export const DESPESA_META_SEP = "\n@@CAP@@\n";

export type EntidadeDespesa =
  | "todos"
  | "fornecedores"
  | "colaboradores"
  | "prestadores"
  | "entregadores"
  | "clientes";

export type AnexoDespesa = {
  name: string;
  type: string;
  url: string;
};

export type DespesaMeta = {
  entidade?: EntidadeDespesa;
  categoria?: string;
  conta?: string;
  parcela?: string;
  referencia?: string;
  nome?: string;
  /** Recibos e comprovantes — imagens ou PDF (máx. 5). */
  anexos?: AnexoDespesa[];
};

export const LIMITE_ANEXOS_DESPESA = 5;
export const LIMITE_ANEXOS_FINANCEIRO = LIMITE_ANEXOS_DESPESA;
/** Referência estável para evitar reset dos anexos a cada re-render do modal. */
export const ANEXOS_FINANCEIRO_VAZIOS: AnexoDespesa[] = [];
export const ACCEPT_ANEXOS_FINANCEIRO =
  "image/*,application/pdf,.pdf,.heic,.heif";

export function arquivoEhAnexoFinanceiro(file: File) {
  if (file.type.startsWith("image/")) return true;
  if (file.type === "application/pdf") return true;
  const nome = file.name.toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif|pdf)$/i.test(nome);
}

export type PastaAnexoFinanceiro = "despesas" | "receitas";

export type DespesaDescompactada = {
  texto: string;
  meta: DespesaMeta;
  nome: string;
  referencia: string;
  categoria: string;
  conta: string;
  parcela: string;
};

export function empacotarDespesa(descricao: string, meta: DespesaMeta) {
  const base = descricao.trim();
  return `${base}${DESPESA_META_SEP}${JSON.stringify(meta)}`;
}

/** Inclui rótulo de parcela no texto visível, sem corromper o JSON em @@CAP@@. */
export function descricaoDespesaComParcela(descricaoEmpacotada: string, parcelaLabel: string) {
  const label = parcelaLabel.trim();
  if (!label) return descricaoEmpacotada;
  const idx = descricaoEmpacotada.indexOf(DESPESA_META_SEP);
  if (idx < 0) {
    return `${descricaoEmpacotada.trim()} (${label})`;
  }
  const texto = descricaoEmpacotada.slice(0, idx).trimEnd();
  const metaPart = descricaoEmpacotada.slice(idx);
  return `${texto} (${label})${metaPart}`;
}

function parseMetaDespesa(metaRaw: string): { meta: DespesaMeta; parcelaNoMeta?: string } {
  const trimmed = metaRaw.trim();
  try {
    return { meta: JSON.parse(trimmed) as DespesaMeta };
  } catch {
    /* compat: "(1/3)" gravado após o JSON por versões antigas */
  }
  const match = trimmed.match(/^(\{[\s\S]*\})\s*(\(\d+\s*\/\s*\d+\))\s*$/);
  if (!match) return { meta: {} };
  try {
    return {
      meta: JSON.parse(match[1]) as DespesaMeta,
      parcelaNoMeta: match[2],
    };
  } catch {
    return { meta: {} };
  }
}

export function desempacotarDespesa(descricao: string): DespesaDescompactada {
  const idx = descricao.indexOf(DESPESA_META_SEP);
  let texto = descricao;
  let meta: DespesaMeta = {};
  if (idx >= 0) {
    texto = descricao.slice(0, idx).trim();
    const parsed = parseMetaDespesa(descricao.slice(idx + DESPESA_META_SEP.length));
    meta = parsed.meta;
    if (parsed.parcelaNoMeta && !/\(\d+\s*\/\s*\d+\)\s*$/.test(texto)) {
      texto = `${texto} ${parsed.parcelaNoMeta}`.trim();
    }
  }

  const orcamento = texto.match(/^Orçamento #(\d+)\s*-\s*(.+)$/i);
  const nome =
    meta.nome ||
    (orcamento?.[2]?.trim() ?? texto.split("\n")[0]?.trim()) ||
    "—";
  const referencia =
    meta.referencia ||
    (orcamento ? `Pedido ${orcamento[1]}` : "") ||
    "—";

  return {
    texto,
    meta,
    nome,
    referencia,
    categoria: meta.categoria || "—",
    conta: meta.conta || "—",
    parcela: meta.parcela || "1",
  };
}

export function lerFornecedoresStorage(): Array<{ id: string; nome: string }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("labProteseFornecedores");
    if (!raw) return [];
    const lista = JSON.parse(raw) as Array<{
      id: string;
      nome?: string;
      razaoSocial?: string;
      cnpj?: string;
    }>;
    if (!Array.isArray(lista)) return [];
    return lista.map((f) => ({
      id: f.id,
      nome: (f.nome || f.razaoSocial || "Fornecedor").trim(),
      cnpj: f.cnpj,
    }));
  } catch {
    return [];
  }
}

export function lerNomesStorage(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const lista = JSON.parse(raw) as Array<{ nome?: string; razaoSocial?: string }>;
    if (!Array.isArray(lista)) return [];
    return lista
      .map((item) => (item.nome || item.razaoSocial || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function classificarEntidadeDespesa(
  nome: string,
  temCliente: boolean,
  listas: {
    fornecedores: string[];
    colaboradores: string[];
    prestadores: string[];
    entregadores: string[];
  }
): EntidadeDespesa {
  if (temCliente) return "clientes";
  const n = nome.toLowerCase();
  if (/orçamento/i.test(nome)) return "fornecedores";
  const match = (lista: string[]) =>
    lista.some((item) => item && n.includes(item.toLowerCase()));
  if (match(listas.fornecedores)) return "fornecedores";
  if (match(listas.colaboradores)) return "colaboradores";
  if (match(listas.prestadores)) return "prestadores";
  if (match(listas.entregadores)) return "entregadores";
  return "fornecedores";
}
