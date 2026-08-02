import { parseBrDate } from "@/lib/datas-br";
import { valorCaixaReceitaPaga } from "@/lib/lancamento-valor-caixa";
import { flagsUrgenciaTrabalho } from "@/lib/modulo-producao-os";

/** Recebimento no financeiro (receita paga) — valor efetivo de caixa na agregação. */
export type RecebimentoCurvaAbc = {
  id: string;
  tipo: string;
  valor: number;
  data: string;
  status: string;
  descricao?: string;
  formaPagamento?: string | null;
  cliente?: { id?: string; nome?: string | null } | null;
  clienteId?: string | null;
  trabalhoId?: string | null;
  numeroOs?: number | null;
};

export type TrabalhoCurvaAbc = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  instrucoes?: string | null;
  clienteId?: string | null;
  clienteNome?: string | null;
};

export type FiltrosCurvaAbcClientes = {
  dataInicio: string;
  dataFim: string;
  /** Vazio = todos; `sim` | `nao` */
  repeticao: string;
  /** Vazio = todos; `sim` | `nao` */
  urgente: string;
};

export type LinhaCurvaAbcCliente = {
  cliente: string;
  percentual: number;
  valor: number;
};

export type SecaoCurvaAbc = {
  classe: "A" | "B" | "C";
  metaPercentual: 50 | 30 | 20;
  linhas: LinhaCurvaAbcCliente[];
  subtotal: number;
};

export type ResultadoCurvaAbcClientes = {
  secoes: SecaoCurvaAbc[];
  total: number;
};

export type IndiceTrabalhosCurvaAbc = {
  porId: Map<string, TrabalhoCurvaAbc>;
  porNumeroOs: Map<number, TrabalhoCurvaAbc[]>;
};

const METAS: { classe: "A" | "B" | "C"; meta: 50 | 30 | 20 }[] = [
  { classe: "A", meta: 50 },
  { classe: "B", meta: 30 },
  { classe: "C", meta: 20 },
];

export function criarIndiceTrabalhosCurvaAbc(
  trabalhos: TrabalhoCurvaAbc[]
): IndiceTrabalhosCurvaAbc {
  const porId = new Map<string, TrabalhoCurvaAbc>();
  const porNumeroOs = new Map<number, TrabalhoCurvaAbc[]>();

  for (const t of trabalhos) {
    porId.set(t.id, t);
    const lista = porNumeroOs.get(t.numeroOs) || [];
    lista.push(t);
    porNumeroOs.set(t.numeroOs, lista);
  }

  return { porId, porNumeroOs };
}

function recebimentoNoPeriodo(
  dataIso: string,
  inicio: Date | null,
  fim: Date | null
) {
  if (!inicio && !fim) return true;
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return false;
  d.setHours(12, 0, 0, 0);
  if (inicio && d < inicio) return false;
  if (fim && d > fim) return false;
  return true;
}

function filtrosOsAtivos(filtros: FiltrosCurvaAbcClientes) {
  return (
    filtros.urgente === "sim" ||
    filtros.urgente === "nao" ||
    filtros.repeticao === "sim" ||
    filtros.repeticao === "nao"
  );
}

function resolverTrabalhoDoRecebimento(
  recebimento: RecebimentoCurvaAbc,
  indice: IndiceTrabalhosCurvaAbc
): TrabalhoCurvaAbc | null {
  const id = recebimento.trabalhoId?.trim();
  if (id) {
    const direto = indice.porId.get(id);
    if (direto) return direto;
  }

  if (recebimento.numeroOs != null) {
    const grupo = indice.porNumeroOs.get(recebimento.numeroOs) || [];
    if (id) {
      const noGrupo = grupo.find((t) => t.id === id);
      if (noGrupo) return noGrupo;
    }
    if (grupo.length === 1) return grupo[0];
    if (recebimento.clienteId) {
      const doCliente = grupo.find((t) => t.clienteId === recebimento.clienteId);
      if (doCliente) return doCliente;
    }
    return grupo[0] ?? null;
  }

  return null;
}

/**
 * Repetição e urgente da OS (marcados no item da ordem de serviço).
 * Vazio = ignora; `sim` = exige flag; `nao` = exige ausência.
 * Com os dois preenchidos, as duas condições devem valer (E).
 */
function passaFiltrosOs(
  flags: { urgente: boolean; repeticao: boolean },
  filtros: FiltrosCurvaAbcClientes
) {
  if (filtros.repeticao === "sim" && !flags.repeticao) return false;
  if (filtros.repeticao === "nao" && flags.repeticao) return false;
  if (filtros.urgente === "sim" && !flags.urgente) return false;
  if (filtros.urgente === "nao" && flags.urgente) return false;
  return true;
}

function passaFiltroUrgenciaRepeticao(
  recebimento: RecebimentoCurvaAbc,
  indice: IndiceTrabalhosCurvaAbc,
  filtros: FiltrosCurvaAbcClientes
) {
  if (!filtrosOsAtivos(filtros)) return true;

  const trabalho = resolverTrabalhoDoRecebimento(recebimento, indice);
  // OS excluída/inexistente: não entra na curva quando o filtro depende da OS.
  if (!trabalho) return false;

  const flags = flagsUrgenciaTrabalho(trabalho);
  return passaFiltrosOs(flags, filtros);
}

function filtrarRecebimentos(
  recebimentos: RecebimentoCurvaAbc[],
  indice: IndiceTrabalhosCurvaAbc,
  filtros: FiltrosCurvaAbcClientes
) {
  const inicio = filtros.dataInicio ? parseBrDate(filtros.dataInicio) : null;
  const fim = filtros.dataFim ? parseBrDate(filtros.dataFim) : null;
  if (inicio) inicio.setHours(0, 0, 0, 0);
  if (fim) fim.setHours(23, 59, 59, 999);

  return recebimentos.filter((r) => {
    if (r.tipo !== "receita") return false;
    if (String(r.status || "").toLowerCase() !== "pago") return false;
    if (!recebimentoNoPeriodo(r.data, inicio, fim)) return false;
    if (!passaFiltroUrgenciaRepeticao(r, indice, filtros)) return false;
    return true;
  });
}

function chaveENomeCliente(
  r: RecebimentoCurvaAbc,
  indice: IndiceTrabalhosCurvaAbc
): { chave: string; nome: string } {
  const id = (r.clienteId || r.cliente?.id || "").trim();
  const nomeDireto = r.cliente?.nome?.trim();
  if (id && nomeDireto) return { chave: `id:${id}`, nome: nomeDireto };
  if (id) {
    const trabalho = resolverTrabalhoDoRecebimento(r, indice);
    const nome = trabalho?.clienteNome?.trim() || nomeDireto || "Sem cliente";
    return { chave: `id:${id}`, nome };
  }
  const trabalho = resolverTrabalhoDoRecebimento(r, indice);
  if (trabalho?.clienteId) {
    return {
      chave: `id:${trabalho.clienteId}`,
      nome: trabalho.clienteNome?.trim() || nomeDireto || "Sem cliente",
    };
  }
  const nome = nomeDireto || trabalho?.clienteNome?.trim() || "Sem cliente";
  return { chave: `nome:${nome.toLowerCase()}`, nome };
}

function agregarPorCliente(
  recebimentos: RecebimentoCurvaAbc[],
  indice: IndiceTrabalhosCurvaAbc,
  todosParaCaixa: RecebimentoCurvaAbc[]
) {
  const mapa = new Map<string, { nome: string; valor: number }>();
  const baseCaixa = todosParaCaixa.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    descricao: r.descricao || "",
    valor: r.valor,
    status: r.status,
    formaPagamento: r.formaPagamento,
    cliente: r.cliente?.id ? { id: r.cliente.id, nome: r.cliente.nome || undefined } : null,
  }));

  for (const r of recebimentos) {
    const valor = valorCaixaReceitaPaga(
      {
        id: r.id,
        tipo: r.tipo,
        descricao: r.descricao || "",
        valor: r.valor,
        status: r.status,
        formaPagamento: r.formaPagamento,
        cliente: r.cliente?.id
          ? { id: r.cliente.id, nome: r.cliente.nome || undefined }
          : null,
      },
      baseCaixa
    );
    if (valor <= 0.009) continue;
    const { chave, nome } = chaveENomeCliente(r, indice);
    const atual = mapa.get(chave);
    if (atual) atual.valor += valor;
    else mapa.set(chave, { nome, valor });
  }

  return [...mapa.values()]
    .map(({ nome, valor }) => ({ cliente: nome, valor }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * Curva ABC por valor atual das OS (produção).
 * Exclusão/edição de OS ou valor reflete imediatamente.
 */
export function gerarCurvaAbcClientesPorOs(
  trabalhos: Array<{
    clienteId?: string | null;
    clienteNome?: string | null;
    valor: number;
    status?: string | null;
  }>
): ResultadoCurvaAbcClientes {
  const mapa = new Map<string, { nome: string; valor: number }>();
  for (const t of trabalhos) {
    if (String(t.status || "").toLowerCase() === "cancelado") continue;
    const valor = Math.max(0, Number(t.valor) || 0);
    if (valor <= 0.009) continue;
    const id = (t.clienteId || "").trim();
    const nome = t.clienteNome?.trim() || "Sem cliente";
    const chave = id ? `id:${id}` : `nome:${nome.toLowerCase()}`;
    const atual = mapa.get(chave);
    if (atual) atual.valor += valor;
    else mapa.set(chave, { nome, valor });
  }
  const agregados = [...mapa.values()]
    .map(({ nome, valor }) => ({ cliente: nome, valor }))
    .sort((a, b) => b.valor - a.valor);
  const total = agregados.reduce((s, a) => s + a.valor, 0);
  return classificarSecoes(agregados, total);
}

function classificarSecoes(agregados: { cliente: string; valor: number }[], total: number) {
  const secoesVazias: SecaoCurvaAbc[] = METAS.map(({ classe, meta }) => ({
    classe,
    metaPercentual: meta,
    linhas: [],
    subtotal: 0,
  }));

  if (total <= 0) {
    return { secoes: secoesVazias, total: 0 };
  }

  const linhasPorClasse: Record<"A" | "B" | "C", LinhaCurvaAbcCliente[]> = {
    A: [],
    B: [],
    C: [],
  };

  let acumuladoPct = 0;

  for (const item of agregados) {
    const percentual = (item.valor / total) * 100;
    const linha: LinhaCurvaAbcCliente = {
      cliente: item.cliente,
      percentual,
      valor: item.valor,
    };

    let classe: "A" | "B" | "C";
    if (acumuladoPct < 50) classe = "A";
    else if (acumuladoPct < 80) classe = "B";
    else classe = "C";

    linhasPorClasse[classe].push(linha);
    acumuladoPct += percentual;
  }

  const secoes: SecaoCurvaAbc[] = METAS.map(({ classe, meta }) => {
    const linhas = linhasPorClasse[classe];
    return {
      classe,
      metaPercentual: meta,
      linhas,
      subtotal: linhas.reduce((s, l) => s + l.valor, 0),
    };
  });

  return { secoes, total };
}

/** Classifica itens por nome em faixas A/B/C (mesma regra da Curva ABC). */
export function classificarCurvaAbcPorNome(
  itens: { nome: string; valor: number }[]
): ResultadoCurvaAbcClientes {
  const mapa = new Map<string, number>();
  for (const item of itens) {
    const nome = item.nome.trim();
    if (!nome || item.valor <= 0) continue;
    mapa.set(nome, (mapa.get(nome) || 0) + item.valor);
  }
  const agregados = [...mapa.entries()]
    .map(([cliente, valor]) => ({ cliente, valor }))
    .sort((a, b) => b.valor - a.valor);
  const total = agregados.reduce((s, a) => s + a.valor, 0);
  return classificarSecoes(agregados, total);
}

/**
 * Curva ABC com base no dinheiro realmente recebido (caixa),
 * sem duplicar fatura + parcial/crédito.
 */
export function gerarCurvaAbcClientes(
  recebimentos: RecebimentoCurvaAbc[],
  indice: IndiceTrabalhosCurvaAbc,
  filtros: FiltrosCurvaAbcClientes
): ResultadoCurvaAbcClientes {
  const filtrados = filtrarRecebimentos(recebimentos, indice, filtros);
  const agregados = agregarPorCliente(filtrados, indice, recebimentos);
  const total = agregados.reduce((s, a) => s + a.valor, 0);
  return classificarSecoes(agregados, total);
}

export function formatarPercentualCurvaAbc(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function exportarCurvaAbcClientesCsv(resultado: ResultadoCurvaAbcClientes) {
  const linhas: string[] = [];
  for (const secao of resultado.secoes) {
    linhas.push(
      `${secao.classe} - ${secao.linhas.length} Clientes representam ${secao.metaPercentual}% do Faturamento`
    );
    linhas.push("CLIENTE;%;VALOR");
    for (const l of secao.linhas) {
      linhas.push(
        `${l.cliente};${formatarPercentualCurvaAbc(l.percentual)};${l.valor.toFixed(2).replace(".", ",")}`
      );
    }
    linhas.push(`;SUBTOTAL;${secao.subtotal.toFixed(2).replace(".", ",")}`);
    linhas.push("");
  }
  linhas.push(`Total;;${resultado.total.toFixed(2).replace(".", ",")}`);

  const blob = new Blob(["\uFEFF" + linhas.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `curva-abc-clientes-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
