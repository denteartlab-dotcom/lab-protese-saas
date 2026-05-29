import { parseBrDate } from "@/lib/datas-br";
import { flagsUrgenciaTrabalho } from "@/lib/modulo-producao-os";

/** Recebimento no financeiro (receita paga). */
export type RecebimentoCurvaAbc = {
  id: string;
  tipo: string;
  valor: number;
  data: string;
  status: string;
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
  if (!inicio || !fim) return true;
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return false;
  d.setHours(12, 0, 0, 0);
  return d >= inicio && d <= fim;
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
    if (r.status !== "pago") return false;
    if (!recebimentoNoPeriodo(r.data, inicio, fim)) return false;
    if (!passaFiltroUrgenciaRepeticao(r, indice, filtros)) return false;
    return true;
  });
}

function nomeClienteRecebimento(r: RecebimentoCurvaAbc) {
  return r.cliente?.nome?.trim() || "Sem cliente";
}

function agregarPorCliente(recebimentos: RecebimentoCurvaAbc[]) {
  const mapa = new Map<string, number>();
  for (const r of recebimentos) {
    const nome = nomeClienteRecebimento(r);
    const valor = Number(r.valor) || 0;
    if (valor <= 0) continue;
    mapa.set(nome, (mapa.get(nome) || 0) + valor);
  }
  return [...mapa.entries()]
    .map(([cliente, valor]) => ({ cliente, valor }))
    .sort((a, b) => b.valor - a.valor);
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

/** Curva ABC com base nos recebimentos (receita paga) do financeiro. */
export function gerarCurvaAbcClientes(
  recebimentos: RecebimentoCurvaAbc[],
  indice: IndiceTrabalhosCurvaAbc,
  filtros: FiltrosCurvaAbcClientes
): ResultadoCurvaAbcClientes {
  const filtrados = filtrarRecebimentos(recebimentos, indice, filtros);
  const agregados = agregarPorCliente(filtrados);
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
