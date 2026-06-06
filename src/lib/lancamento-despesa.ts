import { carregarEntregadoresCadastro } from "@/lib/entregadores-cadastro";
import { readStorage } from "@/lib/persisted-storage";

/** Metadados de despesa embutidos na descrição (Contas a Pagar). */
export const DESPESA_META_SEP = "\n@@CAP@@\n";

export type EntidadeDespesa =
  | "todos"
  | "fornecedores"
  | "colaboradores"
  | "prestadores"
  | "entregadores"
  | "clientes";

export type EntidadeDespesaOpcao = { id: string; nome: string; cnpj?: string };

export const TIPOS_FORNECEDOR_DESPESA: {
  value: Exclude<EntidadeDespesa, "todos">;
  label: string;
}[] = [
  { value: "fornecedores", label: "Fornecedor" },
  { value: "prestadores", label: "Prestador de Serviço" },
  { value: "colaboradores", label: "Colaborador" },
  { value: "clientes", label: "Cliente" },
  { value: "entregadores", label: "Entregador" },
];

export function labelNomeEntidadeDespesa(tipo: string) {
  if (tipo === "clientes") return "Nome do Cliente";
  if (tipo === "colaboradores") return "Nome do Colaborador";
  if (tipo === "prestadores") return "Nome do Prestador de Serviço";
  if (tipo === "entregadores") return "Nome do Entregador";
  return "Nome do Fornecedor";
}

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
  const nome = file.name.toLowerCase();
  if (/\.pdf$/i.test(nome)) return true;
  if (file.type === "application/pdf") return true;
  if (file.type.startsWith("image/")) return true;
  if (
    file.type === "application/octet-stream" &&
    /\.(jpe?g|png|gif|webp|bmp|heic|heif|pdf)$/i.test(nome)
  ) {
    return true;
  }
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
    const lista = readStorage<
      Array<{
        id: string;
        nome?: string;
        razaoSocial?: string;
        cnpj?: string;
      }>
    >("labProteseFornecedores", []);
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

function lerEntidadesStorage(key: string): EntidadeDespesaOpcao[] {
  if (typeof window === "undefined") return [];
  try {
    const lista = readStorage<
      Array<{ id?: string; nome?: string; razaoSocial?: string; cnpj?: string }>
    >(key, []);
    if (!Array.isArray(lista)) return [];
    const result: EntidadeDespesaOpcao[] = [];
    lista.forEach((item, index) => {
      const nome = (item.nome || item.razaoSocial || "").trim();
      if (!nome) return;
      result.push({
        id: String(item.id || `${key}-${index}-${nome}`),
        nome,
        ...(item.cnpj ? { cnpj: item.cnpj } : {}),
      });
    });
    return result.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  } catch {
    return [];
  }
}

export function carregarEntidadesDespesaLocal(
  tipo: Exclude<EntidadeDespesa, "todos">
): EntidadeDespesaOpcao[] {
  if (tipo === "fornecedores") return lerFornecedoresStorage();
  if (tipo === "colaboradores") return lerEntidadesStorage("labProteseColaboradores");
  if (tipo === "prestadores") return lerEntidadesStorage("labProtesePrestadores");
  if (tipo === "entregadores") {
    return carregarEntregadoresCadastro().map((item) => ({
      id: item.id,
      nome: item.nome,
    }));
  }
  return [];
}

export function lerNomesStorage(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const lista = readStorage<Array<{ nome?: string; razaoSocial?: string }>>(key, []);
    if (!Array.isArray(lista)) return [];
    return lista
      .map((item) => (item.nome || item.razaoSocial || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export type LancamentoDespesaDetalhe = {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { nome?: string } | null;
  trabalho?: { numeroOs?: number } | null;
};

export type ItemDespesaVisualizacao = {
  id: string;
  produto: string;
  descricao: string;
  quantidade: string;
  custoUnitario: string;
};

export type ParcelaDespesaVisualizacao = {
  parcela: string;
  formaPagamento: string;
  conta: string;
  vencimento: string;
  codigoBarrasPix: string;
  valor: string;
  pago: boolean;
};

export type DadosVisualizacaoDespesa = {
  tipoFornecedor: Exclude<EntidadeDespesa, "todos">;
  nomeEntidade: string;
  categoria: string;
  dataLancamento: string;
  notaFiscalRef: string;
  itens: ItemDespesaVisualizacao[];
  observacoes: string;
  valorBruto: number;
  totalLiquido: number;
  numParcelas: number;
  parcelas: ParcelaDespesaVisualizacao[];
  anexos: AnexoDespesa[];
};

function moneyBr(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function descricaoSemParcela(texto: string) {
  return texto.replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/, "").trim();
}

function parseItensDespesaSalva(texto: string, valorTotal: number) {
  const partes = texto.split("|").map((p) => p.trim()).filter(Boolean);
  let observacoes = "";
  let corpo = texto;
  if (partes.length > 1) {
    observacoes = partes[partes.length - 1];
    corpo = partes.slice(0, -1).join(" | ");
  }

  const segmentos = corpo.split(";").map((s) => s.trim()).filter(Boolean);
  if (!segmentos.length) {
    return {
      itens: [
        {
          id: "item-0",
          produto: "",
          descricao: texto.trim() || "—",
          quantidade: "1",
          custoUnitario: moneyBr(valorTotal),
        },
      ],
      observacoes,
    };
  }

  const itens = segmentos.map((seg, index) => {
    const dashIdx = seg.indexOf(" - ");
    if (dashIdx >= 0) {
      return {
        id: `item-${index}`,
        produto: seg.slice(0, dashIdx).trim(),
        descricao: seg.slice(dashIdx + 3).trim(),
        quantidade: "1",
        custoUnitario:
          segmentos.length === 1 ? moneyBr(valorTotal) : "0,00",
      };
    }
    return {
      id: `item-${index}`,
      produto: "",
      descricao: seg,
      quantidade: "1",
      custoUnitario: segmentos.length === 1 ? moneyBr(valorTotal) : "0,00",
    };
  });

  const somaItens = itens.reduce((sum, item) => {
    const qtd = Number(item.quantidade.replace(",", ".")) || 0;
    const unit =
      Number(
        item.custoUnitario.replace(/\./g, "").replace(",", ".")
      ) || 0;
    return sum + qtd * unit;
  }, 0);

  if (somaItens <= 0 && valorTotal > 0 && itens.length === 1) {
    itens[0].custoUnitario = moneyBr(valorTotal);
  }

  return { itens, observacoes };
}

function rotuloParcelaDespesa(texto: string, parcelaMeta: string) {
  const match = texto.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (match) {
    return {
      parcela: `${match[1]}/${match[2]}`,
      numParcelas: Number(match[2]) || 1,
    };
  }
  const total = Number.parseInt(parcelaMeta, 10);
  if (Number.isFinite(total) && total > 1) {
    return { parcela: `1/${total}`, numParcelas: total };
  }
  return { parcela: "1/1", numParcelas: 1 };
}

export function extrairDadosVisualizacaoDespesa(
  lancamento: LancamentoDespesaDetalhe,
  refOs?: string
): DadosVisualizacaoDespesa {
  const pack = desempacotarDespesa(lancamento.descricao);
  const textoBase = descricaoSemParcela(pack.texto);
  const { itens, observacoes } = parseItensDespesaSalva(textoBase, lancamento.valor);
  const { parcela, numParcelas } = rotuloParcelaDespesa(pack.texto, pack.parcela);

  const referencia =
    refOs ||
    (pack.referencia !== "—"
      ? pack.referencia
      : lancamento.trabalho?.numeroOs != null
        ? `OS ${lancamento.trabalho.numeroOs}`
        : "");

  const notaFiscalRef =
    referencia && !/^OS\s+\d+/i.test(referencia) ? referencia : "";

  const valorBruto = itens.reduce((sum, item) => {
    const qtd = Number(item.quantidade.replace(",", ".")) || 0;
    const unit =
      Number(
        item.custoUnitario.replace(/\./g, "").replace(",", ".")
      ) || 0;
    return sum + qtd * unit;
  }, 0);

  const totalLiquido = valorBruto > 0 ? valorBruto : lancamento.valor;
  const entidade = (pack.meta.entidade || "fornecedores") as Exclude<
    EntidadeDespesa,
    "todos"
  >;

  return {
    tipoFornecedor: entidade,
    nomeEntidade: lancamento.cliente?.nome?.trim() || pack.nome,
    categoria: pack.categoria === "—" ? "" : pack.categoria,
    dataLancamento: lancamento.data,
    notaFiscalRef,
    itens,
    observacoes,
    valorBruto: totalLiquido,
    totalLiquido,
    numParcelas,
    parcelas: [
      {
        parcela,
        formaPagamento: lancamento.formaPagamento?.trim() || "",
        conta: pack.conta === "—" ? "Caixa Principal" : pack.conta,
        vencimento: lancamento.data,
        codigoBarrasPix: "",
        valor: moneyBr(lancamento.valor),
        pago: lancamento.status === "pago",
      },
    ],
    anexos: pack.meta.anexos ?? [],
  };
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
