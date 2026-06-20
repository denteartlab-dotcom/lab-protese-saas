import { somarDiasIso } from "@/lib/datas-br";
import { carregarEntregadoresCadastro } from "@/lib/entregadores-cadastro";
import { readStorage } from "@/lib/persisted-storage";

const INTERVALO_DIAS_PARCELA = 30;

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

/** Remove metadados técnicos embutidos na descrição (ex.: @@trab:id@@) para exibição. */
function limparTextoVisivelDescricao(texto: string) {
  return texto
    .split("\n@@REC@@\n")[0]
    .replace(/(\s*)@@[^@]+@@/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function descricaoLancamentoExibicao(descricao: string) {
  const pack = desempacotarDespesa(descricao);
  return pack.texto || pack.nome || "—";
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

  texto = limparTextoVisivelDescricao(texto);

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

function dataIsoParaBr(iso: string) {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function parcelaParaEdicao(
  item: LancamentoDespesaDetalhe,
  numero: number,
  total: number
): ParcelaDespesaVisualizacao {
  const pack = desempacotarDespesa(item.descricao);
  return {
    parcela: `${numero}/${total}`,
    formaPagamento: item.formaPagamento?.trim() || "",
    conta: pack.conta === "—" ? "Caixa Principal" : pack.conta,
    vencimento: dataIsoParaBr(item.data),
    codigoBarrasPix: "",
    valor: moneyBr(item.valor),
    pago: item.status === "pago",
  };
}

/** Dados do formulário ao editar despesa (inclui todas as parcelas do grupo). */
export function extrairDadosEdicaoDespesa(
  lancamento: LancamentoDespesaDetalhe,
  todosLancamentos: LancamentoDespesaDetalhe[] = [],
  refOs?: string
): DadosVisualizacaoDespesa {
  const base = extrairDadosVisualizacaoDespesa(lancamento, refOs);
  const chave = chaveGrupoDespesa(lancamento.descricao);
  const irmaos = todosLancamentos.filter(
    (item) =>
      item.id !== lancamento.id && chaveGrupoDespesa(item.descricao) === chave
  );
  const grupo = [lancamento, ...irmaos];

  if (grupo.length > 1) {
    const ordenado = grupo
      .map((item) => {
        const pack = desempacotarDespesa(item.descricao);
        const match = pack.texto.match(/\((\d+)\s*\/\s*(\d+)\)/);
        const numero = match ? Number(match[1]) || 1 : 1;
        const total = match ? Number(match[2]) || grupo.length : grupo.length;
        return { item, numero, total };
      })
      .sort((a, b) => a.numero - b.numero);
    const total = ordenado[0]?.total || ordenado.length;
    const parcelas = ordenado.map(({ item, numero }) =>
      parcelaParaEdicao(item, numero, total)
    );
    const totalLiquido = parcelas.reduce(
      (sum, p) =>
        sum +
        (Number(p.valor.replace(/\./g, "").replace(",", ".")) || 0),
      0
    );

    return {
      ...base,
      dataLancamento: ordenado[0]?.item.data || lancamento.data,
      numParcelas: total,
      parcelas,
      valorBruto: totalLiquido > 0 ? totalLiquido : base.valorBruto,
      totalLiquido: totalLiquido > 0 ? totalLiquido : base.totalLiquido,
    };
  }

  const pack = desempacotarDespesa(lancamento.descricao);
  const { parcela, numParcelas } = rotuloParcelaDespesa(pack.texto, pack.parcela);
  const match = parcela.match(/^(\d+)\s*\/\s*(\d+)$/);
  const numAtual = match ? Number(match[1]) || 1 : 1;

  if (numParcelas > 1) {
    const parcelas: ParcelaDespesaVisualizacao[] = [];
    for (let n = 1; n <= numParcelas; n++) {
      const isAtual = n === numAtual;
      parcelas.push({
        parcela: `${n}/${numParcelas}`,
        formaPagamento: isAtual
          ? lancamento.formaPagamento?.trim() || ""
          : "",
        conta: pack.conta === "—" ? "Caixa Principal" : pack.conta,
        vencimento: dataIsoParaBr(
          somarDiasIso(lancamento.data, (n - 1) * INTERVALO_DIAS_PARCELA)
        ),
        codigoBarrasPix: "",
        valor: moneyBr(lancamento.valor),
        pago: isAtual && lancamento.status === "pago",
      });
    }
    const totalLiquido = lancamento.valor * numParcelas;
    return {
      ...base,
      numParcelas,
      parcelas,
      valorBruto: totalLiquido,
      totalLiquido,
    };
  }

  return {
    ...base,
    parcelas: [
      {
        parcela,
        formaPagamento: lancamento.formaPagamento?.trim() || "",
        conta: pack.conta === "—" ? "Caixa Principal" : pack.conta,
        vencimento: dataIsoParaBr(lancamento.data),
        codigoBarrasPix: "",
        valor: moneyBr(lancamento.valor),
        pago: lancamento.status === "pago",
      },
    ],
  };
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

export type ParcelaPagarDespesa = ParcelaDespesaVisualizacao & {
  lancamentoId: string | null;
  numero: number;
  pagarAgora: boolean;
};

export type DadosPagarDespesa = DadosVisualizacaoDespesa & {
  parcelasGrupo: ParcelaPagarDespesa[];
  valorDevido: number;
};

function parseMoneyBr(value: string) {
  return (
    Number(
      value
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    ) || 0
  );
}

function parcelaNumeros(texto: string, parcelaMeta: string) {
  const match = texto.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (match) {
    return { numero: Number(match[1]) || 1, total: Number(match[2]) || 1 };
  }
  const total = Number.parseInt(parcelaMeta, 10);
  if (Number.isFinite(total) && total > 1) {
    return { numero: 1, total };
  }
  return { numero: 1, total: 1 };
}

export function chaveGrupoDespesa(descricao: string) {
  const pack = desempacotarDespesa(descricao);
  const texto = descricaoSemParcela(pack.texto);
  return `${pack.nome}::${texto}`;
}

export function extrairDadosPagarDespesa(
  lancamento: LancamentoDespesaDetalhe,
  refOs?: string,
  todosLancamentos: LancamentoDespesaDetalhe[] = []
): DadosPagarDespesa {
  const dados = extrairDadosVisualizacaoDespesa(lancamento, refOs);
  const chave = chaveGrupoDespesa(lancamento.descricao);
  const irmaos = todosLancamentos.filter(
    (item) => item.id !== lancamento.id && chaveGrupoDespesa(item.descricao) === chave
  );
  const grupo = [lancamento, ...irmaos];

  let parcelasGrupo: ParcelaPagarDespesa[] = [];

  if (grupo.length > 1) {
    const ordenado = grupo
      .map((item) => {
        const pack = desempacotarDespesa(item.descricao);
        const { numero, total } = parcelaNumeros(pack.texto, pack.parcela);
        return { item, numero, total, pack };
      })
      .sort((a, b) => a.numero - b.numero);
    parcelasGrupo = ordenado.map(({ item, numero, total }) => ({
      parcela: `${numero}/${total}`,
      formaPagamento: "",
      conta: "",
      vencimento: item.data,
      codigoBarrasPix: "",
      valor: moneyBr(item.valor),
      pago: item.status === "pago",
      lancamentoId: item.id,
      numero,
      pagarAgora: item.id === lancamento.id && item.status !== "pago",
    }));
  } else {
    const pack = desempacotarDespesa(lancamento.descricao);
    const { numero: numAtual, total } = parcelaNumeros(pack.texto, pack.parcela);

    if (total > 1) {
      const valorParcela = lancamento.valor;
      for (let n = 1; n <= total; n++) {
        const isAtual = n === numAtual;
        parcelasGrupo.push({
          parcela: `${n}/${total}`,
          formaPagamento: "",
          conta: "",
          vencimento: somarDiasIso(lancamento.data, (n - 1) * INTERVALO_DIAS_PARCELA),
          codigoBarrasPix: "",
          valor: moneyBr(valorParcela),
          pago: isAtual && lancamento.status === "pago",
          lancamentoId: isAtual ? lancamento.id : null,
          numero: n,
          pagarAgora: isAtual && lancamento.status !== "pago",
        });
      }
    } else {
      parcelasGrupo = [
        {
          parcela: "1/1",
          formaPagamento: lancamento.formaPagamento?.trim() || "",
          conta: "",
          vencimento: lancamento.data,
          codigoBarrasPix: "",
          valor: moneyBr(lancamento.valor),
          pago: lancamento.status === "pago",
          lancamentoId: lancamento.id,
          numero: 1,
          pagarAgora: lancamento.status !== "pago",
        },
      ];
    }
  }

  const totalLiquido = parcelasGrupo.reduce(
    (sum, parcela) => sum + parseMoneyBr(parcela.valor),
    0
  );
  const valorDevido = parcelasGrupo
    .filter((parcela) => !parcela.pago)
    .reduce((sum, parcela) => sum + parseMoneyBr(parcela.valor), 0);

  return {
    ...dados,
    totalLiquido: totalLiquido > 0 ? totalLiquido : dados.totalLiquido,
    parcelasGrupo,
    valorDevido,
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
