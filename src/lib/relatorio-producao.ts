import { parseBrDate } from "@/lib/datas-br";
import {
  carregarEtapasCadastro,
  colaboradoresParaExibicaoControle,
  parseColaboradoresInstrucoes,
  parseEtapasInstrucoes,
  resumoColaboradorControle,
  tempoMinutosEtapa,
  type EtapaCadastro,
} from "@/lib/etapas-os";
import {
  categoriaDoServicoNaTabela,
  type CategoriaTabelaPrecoOs,
} from "@/lib/tabela-precos-os";
import { flagsUrgenciaTrabalho } from "@/lib/modulo-producao-os";
import { metaStatusOs } from "@/lib/status-os";
import { normalizarColaborador, STATUS_TRABALHO } from "@/lib/utils";

/** Opções do Smart Prótese — Relatório de Produção */
export const OPCOES_RELATORIO_PRODUCAO = [
  {
    value: "servicos_lista",
    label: "Serviços (Lista)",
    descricao: "Uma linha por serviço/OS no período",
  },
  {
    value: "servicos_agrupados",
    label: "Serviços (Agrupados)",
    descricao: "Resumo por serviço com quantidade, valor e % do total",
  },
  {
    value: "servicos_etapas",
    label: "Serviços (Etapas)",
    descricao: "Uma linha para cada etapa de produção da OS",
  },
  {
    value: "colaboradores_lista",
    label: "Colaboradores (Lista)",
    descricao: "Uma linha por colaborador vinculado à OS",
  },
  {
    value: "colaboradores_agrupados",
    label: "Colaboradores (Agrupados)",
    descricao: "Agrupa por colaborador com subtotal",
  },
  {
    value: "setores_lista",
    label: "Setores (Lista)",
    descricao: "Uma linha por setor/etapa conforme cadastro",
  },
  {
    value: "setores_agrupados",
    label: "Setores (Agrupados)",
    descricao: "Agrupa por setor com subtotal",
  },
  {
    value: "categorias_lista",
    label: "Categorias (Lista)",
    descricao: "Lista com categoria da tabela de preços",
  },
  {
    value: "categorias_agrupados",
    label: "Categorias (Agrupados)",
    descricao: "Agrupa por categoria da tabela de preços",
  },
  {
    value: "clientes_lista",
    label: "Clientes (Lista)",
    descricao: "Lista ordenada por cliente",
  },
] as const;

export type OpcaoRelatorioProducao = (typeof OPCOES_RELATORIO_PRODUCAO)[number]["value"];

export type CampoPeriodoProducao = "data_lancamento" | "data_entrega" | "data_prevista";

export type OrdenacaoProducao = "data" | "os" | "cliente" | "paciente" | "servico";

export type LayoutTabelaRelatorioProducao =
  | "detalhada"
  | "servicos_agrupados"
  | "servicos_etapas";

/** Situações do filtro (Smart Prótese). */
export const SITUACOES_FILTRO_RELATORIO_PRODUCAO: { key: string; label: string }[] = [
  ...Object.entries(STATUS_TRABALHO).map(([key, info]) => ({ key, label: info.label })),
  { key: "produto", label: "Produto" },
  { key: "transporte", label: "Transporte" },
];

/** Badges no estilo Smart Prótese (relatório de produção). */
export const BADGE_SITUACAO_RELATORIO: Record<string, string> = {
  pedido: "inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-[#6b7280] text-white",
  producao: "inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-[#f0ad4e] text-white",
  pendente: "inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-[#9ca3af] text-white",
  prova: "inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-[#f0ad4e] text-white",
  cancelado: "inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-[#d9534f] text-white",
  finalizado: "inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-[#5bc0de] text-white",
  saiu_entrega: "inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-[#5bc0de] text-white",
  entregue: "inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-[#5cb85c] text-white",
  produto: "inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-[#6b7280] text-white",
  transporte: "inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-[#6b7280] text-white",
};

export function classeBadgeSituacaoRelatorio(situacaoKey: string) {
  return (
    BADGE_SITUACAO_RELATORIO[situacaoKey] ||
    "inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-[#9ca3af] text-white"
  );
}

export type TipoLinhaRelatorio = "dados" | "grupo" | "subtotal";

export type TrabalhoRelatorioProducao = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  dentes?: string | null;
  cor?: string | null;
  status: string;
  valor: number;
  dataEntrada: string;
  dataPrevista?: string | null;
  dataEntrega?: string | null;
  observacoes?: string | null;
  instrucoes?: string | null;
  cliente?: { nome?: string | null };
  paciente?: { nome?: string | null };
};

export type LinhaRelatorioProducao = {
  id: string;
  tipo: TipoLinhaRelatorio;
  data: string;
  os: number | "";
  qtd: number | "";
  descricao: string;
  cor: string;
  dente: string;
  cliente: string;
  paciente: string;
  colaborador: string;
  situacao: string;
  situacaoKey?: string;
  valor: number | "";
  /** % do valor total da produção (modo Serviços Agrupados). */
  percentual?: number;
};

export function layoutTabelaRelatorioProducao(
  opcao: OpcaoRelatorioProducao
): LayoutTabelaRelatorioProducao {
  if (opcao === "servicos_agrupados") return "servicos_agrupados";
  if (opcao === "servicos_etapas") return "servicos_etapas";
  return "detalhada";
}

export type EtapaRelatorioProducao = {
  id: string;
  etapa: string;
  colaborador: string;
  dataInicio: string;
  dataFim: string;
  tempoMinutos: number;
  situacao: string;
  situacaoKey: string;
};

export type LinhaServicoEtapas = {
  id: string;
  data: string;
  os: number;
  qtd: number;
  descricao: string;
  cor: string;
  dente: string;
  cliente: string;
  paciente: string;
  dataEntregue: string;
  situacao: string;
  situacaoKey: string;
  valor: number;
  etapas: EtapaRelatorioProducao[];
  tempoTotalMinutos: number;
};

export type ResultadoRelatorioProducao =
  | { layout: "detalhada" | "servicos_agrupados"; linhas: LinhaRelatorioProducao[] }
  | { layout: "servicos_etapas"; linhas: LinhaServicoEtapas[] };

export type FiltrosRelatorioProducao = {
  dataInicio: string;
  dataFim: string;
  campoPeriodo: CampoPeriodoProducao;
  /** @deprecated use situacoes */
  situacao?: string;
  /** Várias situações (chips). Vazio = todas. */
  situacoes: string[];
  cliente: string;
  colaborador: string;
  /** Vazio = todos; `sim` | `nao` */
  repeticao: string;
  /** Vazio = todos; `sim` | `nao` */
  urgente: string;
  ordenacao: OrdenacaoProducao;
  opcaoRelatorio: OpcaoRelatorioProducao;
};

export type ContextoRelatorioProducao = {
  categoriasTabela: CategoriaTabelaPrecoOs[];
  etapasCadastro?: EtapaCadastro[];
};

function formatDataBr(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

/** Situação exibida na listagem — mesma fonte do Controle de Produção (`trabalho.status`). */
export function situacaoServicoDoTrabalho(trabalho: TrabalhoRelatorioProducao) {
  const status = (trabalho.status || "").trim() || "pendente";
  const meta = metaStatusOs(status);
  return { label: meta.label, key: meta.key, statusRaw: status };
}

function dataNoPeriodo(
  trabalho: TrabalhoRelatorioProducao,
  campo: CampoPeriodoProducao,
  inicio: Date | null,
  fim: Date | null
) {
  if (!inicio || !fim) return true;
  const raw =
    campo === "data_entrega"
      ? trabalho.dataEntrega
      : campo === "data_prevista"
        ? trabalho.dataPrevista
        : trabalho.dataEntrada;
  if (!raw) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  d.setHours(12, 0, 0, 0);
  return d >= inicio && d <= fim;
}

function filtrarTrabalhos(
  trabalhos: TrabalhoRelatorioProducao[],
  filtros: FiltrosRelatorioProducao
) {
  const inicio = filtros.dataInicio ? parseBrDate(filtros.dataInicio) : null;
  const fim = filtros.dataFim ? parseBrDate(filtros.dataFim) : null;
  if (inicio) inicio.setHours(0, 0, 0, 0);
  if (fim) fim.setHours(23, 59, 59, 999);

  const situacoesAtivas =
    filtros.situacoes?.length > 0
      ? filtros.situacoes
      : filtros.situacao
        ? [filtros.situacao]
        : [];

  return trabalhos.filter((t) => {
    if (!dataNoPeriodo(t, filtros.campoPeriodo, inicio, fim)) return false;
    if (situacoesAtivas.length > 0) {
      const sit = situacaoServicoDoTrabalho(t);
      const statusOk =
        situacoesAtivas.includes(sit.key) || situacoesAtivas.includes(t.status);
      const produtoOk =
        situacoesAtivas.includes("produto") &&
        /produto|material enviado/i.test(t.instrucoes || t.tipoProtese || "");
      const transporteOk =
        situacoesAtivas.includes("transporte") &&
        /transporte|caixa:/i.test(t.instrucoes || t.tipoProtese || "");
      if (!statusOk && !produtoOk && !transporteOk) return false;
    }
    if (filtros.cliente && filtros.cliente !== "Todos") {
      if ((t.cliente?.nome || "").toLowerCase() !== filtros.cliente.toLowerCase()) {
        return false;
      }
    }
    if (filtros.colaborador && filtros.colaborador !== "Todos") {
      const etapas = parseEtapasInstrucoes(t.instrucoes);
      const cols = colaboradoresParaExibicaoControle(
        parseColaboradoresInstrucoes(t.instrucoes),
        etapas
      );
      if (!cols.some((c) => c.nome.toLowerCase() === filtros.colaborador.toLowerCase())) {
        return false;
      }
    }
    const flags = flagsUrgenciaTrabalho(t);
    if (filtros.urgente === "sim" && !flags.urgente) return false;
    if (filtros.urgente === "nao" && flags.urgente) return false;
    if (filtros.repeticao === "sim" && !flags.repeticao) return false;
    if (filtros.repeticao === "nao" && flags.repeticao) return false;
    return true;
  });
}

function baseLinha(
  t: TrabalhoRelatorioProducao,
  parcial?: Partial<LinhaRelatorioProducao>
): LinhaRelatorioProducao {
  const etapas = parseEtapasInstrucoes(t.instrucoes);
  const colaboradores = colaboradoresParaExibicaoControle(
    parseColaboradoresInstrucoes(t.instrucoes),
    etapas
  );
  const sit = situacaoServicoDoTrabalho(t);
  return {
    id: parcial?.id ?? t.id,
    tipo: "dados",
    data: formatDataBr(t.dataEntrada),
    os: t.numeroOs,
    qtd: 1,
    descricao: t.tipoProtese || "",
    cor: t.cor?.trim() || "",
    dente: t.dentes?.trim() || "",
    cliente: t.cliente?.nome?.trim() || "",
    paciente: t.paciente?.nome?.trim() || "",
    colaborador: resumoColaboradorControle(colaboradores),
    situacao: sit.label,
    situacaoKey: sit.key,
    valor: Number(t.valor) || 0,
    ...parcial,
  };
}

function setorDaEtapa(nomeEtapa: string, etapasCadastro: EtapaCadastro[]) {
  const norm = nomeEtapa.trim().toLowerCase();
  const found = etapasCadastro.find((e) => e.nome.trim().toLowerCase() === norm);
  return found?.setor?.trim() || "Sem setor";
}

function categoriaDoTrabalho(t: TrabalhoRelatorioProducao, categorias: CategoriaTabelaPrecoOs[]) {
  return categoriaDoServicoNaTabela(categorias, t.tipoProtese) || "Sem categoria";
}

function ordenarLinhasDados(linhas: LinhaRelatorioProducao[], ordenacao: OrdenacaoProducao) {
  const dados = linhas.filter((l) => l.tipo === "dados");
  dados.sort((a, b) => {
    switch (ordenacao) {
      case "os":
        return Number(b.os) - Number(a.os);
      case "cliente":
        return a.cliente.localeCompare(b.cliente, "pt-BR");
      case "paciente":
        return a.paciente.localeCompare(b.paciente, "pt-BR");
      case "servico":
        return a.descricao.localeCompare(b.descricao, "pt-BR");
      case "data":
      default: {
        const da = parseBrDate(String(a.data))?.getTime() ?? 0;
        const db = parseBrDate(String(b.data))?.getTime() ?? 0;
        return db - da;
      }
    }
  });
  return dados;
}

function montarAgrupado(
  linhasDados: LinhaRelatorioProducao[],
  chaveGrupo: (l: LinhaRelatorioProducao) => string,
  tituloGrupo: (chave: string) => string
): LinhaRelatorioProducao[] {
  const mapa = new Map<string, LinhaRelatorioProducao[]>();
  for (const linha of linhasDados) {
    const chave = chaveGrupo(linha) || "—";
    const lista = mapa.get(chave) ?? [];
    lista.push(linha);
    mapa.set(chave, lista);
  }

  const chaves = [...mapa.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const saida: LinhaRelatorioProducao[] = [];

  for (const chave of chaves) {
    const grupoLinhas = mapa.get(chave) ?? [];
    const subQtd = grupoLinhas.reduce((s, l) => s + Number(l.qtd || 0), 0);
    const subValor = grupoLinhas.reduce((s, l) => s + Number(l.valor || 0), 0);

    saida.push({
      id: `grupo-${chave}`,
      tipo: "grupo",
      data: "",
      os: "",
      qtd: "",
      descricao: tituloGrupo(chave),
      cor: "",
      dente: "",
      cliente: "",
      paciente: "",
      colaborador: "",
      situacao: "",
      valor: "",
    });

    saida.push(...grupoLinhas);

    saida.push({
      id: `subtotal-${chave}`,
      tipo: "subtotal",
      data: "",
      os: "",
      qtd: subQtd,
      descricao: "Subtotal",
      cor: "",
      dente: "",
      cliente: "",
      paciente: "",
      colaborador: "",
      situacao: "",
      valor: subValor,
    });
  }

  return saida;
}

function gerarServicosLista(trabalhos: TrabalhoRelatorioProducao[]) {
  return trabalhos.map((t) => baseLinha(t));
}

function gerarServicosAgrupadosResumo(
  trabalhos: TrabalhoRelatorioProducao[],
  ordenacao: OrdenacaoProducao
): LinhaRelatorioProducao[] {
  const mapa = new Map<string, { qtd: number; valor: number }>();
  for (const t of trabalhos) {
    const nome = (t.tipoProtese || "—").trim() || "—";
    const atual = mapa.get(nome) ?? { qtd: 0, valor: 0 };
    mapa.set(nome, {
      qtd: atual.qtd + 1,
      valor: atual.valor + (Number(t.valor) || 0),
    });
  }

  const totalValor = [...mapa.values()].reduce((s, g) => s + g.valor, 0);

  const linhas: LinhaRelatorioProducao[] = [...mapa.entries()].map(([descricao, grupo]) => ({
    id: `resumo-${descricao}`,
    tipo: "dados" as const,
    data: "",
    os: "",
    qtd: grupo.qtd,
    descricao,
    cor: "",
    dente: "",
    cliente: "",
    paciente: "",
    colaborador: "",
    situacao: "",
    valor: grupo.valor,
    percentual: totalValor > 0 ? (grupo.valor / totalValor) * 100 : 0,
  }));

  linhas.sort((a, b) => {
    switch (ordenacao) {
      case "servico":
        return a.descricao.localeCompare(b.descricao, "pt-BR");
      case "cliente":
        return a.descricao.localeCompare(b.descricao, "pt-BR");
      case "os":
        return Number(b.qtd) - Number(a.qtd);
      case "paciente":
        return a.descricao.localeCompare(b.descricao, "pt-BR");
      case "data":
      default:
        return Number(b.valor) - Number(a.valor);
    }
  });

  return linhas;
}

/** OS com ao menos uma etapa nas instruções (Etapa …:). */
export function trabalhoTemEtapasCadastradas(instrucoes?: string | null) {
  return parseEtapasInstrucoes(instrucoes).some((e) => e.nome.trim().length > 0);
}

function gerarServicosEtapasExpandivel(
  trabalhos: TrabalhoRelatorioProducao[],
  etapasCadastro: EtapaCadastro[],
  ordenacao: OrdenacaoProducao
): LinhaServicoEtapas[] {
  const comEtapas = trabalhos.filter((t) => trabalhoTemEtapasCadastradas(t.instrucoes));

  const linhas: LinhaServicoEtapas[] = comEtapas.map((t) => {
    const etapasRaw = parseEtapasInstrucoes(t.instrucoes);
    const sitServico = situacaoServicoDoTrabalho(t);

    const etapas: EtapaRelatorioProducao[] = etapasRaw.map((etapa, idx) => {
      const cad = etapasCadastro.find(
        (e) => e.nome.trim().toLowerCase() === etapa.nome.trim().toLowerCase()
      );
      return {
        id: `${t.id}-etapa-${idx}`,
        etapa: etapa.nome || "—",
        colaborador: etapa.responsavel.trim() || "—",
        dataInicio: "",
        dataFim: "",
        tempoMinutos: tempoMinutosEtapa(etapa.tempo, cad?.tempoMedio),
        situacao: sitServico.label,
        situacaoKey: sitServico.key,
      };
    });

    const tempoTotalMinutos = etapas.reduce((s, e) => s + e.tempoMinutos, 0);

    return {
      id: t.id,
      data: formatDataBr(t.dataEntrada),
      os: t.numeroOs,
      qtd: 1,
      descricao: t.tipoProtese || "—",
      cor: t.cor?.trim() || "",
      dente: t.dentes?.trim() || "",
      cliente: t.cliente?.nome?.trim() || "",
      paciente: t.paciente?.nome?.trim() || "",
      dataEntregue: t.dataEntrega ? formatDataBr(t.dataEntrega) : "",
      situacao: sitServico.label,
      situacaoKey: sitServico.key,
      valor: Number(t.valor) || 0,
      etapas,
      tempoTotalMinutos,
    };
  });

  linhas.sort((a, b) => {
    switch (ordenacao) {
      case "os":
        return b.os - a.os;
      case "cliente":
        return a.cliente.localeCompare(b.cliente, "pt-BR");
      case "paciente":
        return a.paciente.localeCompare(b.paciente, "pt-BR");
      case "servico":
        return a.descricao.localeCompare(b.descricao, "pt-BR");
      case "data":
      default: {
        const da = parseBrDate(a.data)?.getTime() ?? 0;
        const db = parseBrDate(b.data)?.getTime() ?? 0;
        return db - da;
      }
    }
  });

  return linhas;
}

function gerarColaboradoresLista(trabalhos: TrabalhoRelatorioProducao[]) {
  const linhas: LinhaRelatorioProducao[] = [];
  for (const t of trabalhos) {
    const etapas = parseEtapasInstrucoes(t.instrucoes);
    const cols = colaboradoresParaExibicaoControle(
      parseColaboradoresInstrucoes(t.instrucoes),
      etapas
    );
    if (cols.length === 0) {
      linhas.push(baseLinha(t, { colaborador: "" }));
      continue;
    }
    const valorCol = (Number(t.valor) || 0) / cols.length;
    cols.forEach((col, idx) => {
      linhas.push(
        baseLinha(t, {
          id: `${t.id}-col-${idx}`,
          colaborador: col.nome,
          descricao: col.etapa ? `${t.tipoProtese} (${col.etapa})` : t.tipoProtese,
          valor: valorCol,
        })
      );
    });
  }
  return linhas;
}

function gerarSetoresLista(
  trabalhos: TrabalhoRelatorioProducao[],
  etapasCadastro: EtapaCadastro[]
) {
  const linhas: LinhaRelatorioProducao[] = [];
  for (const t of trabalhos) {
    const etapas = parseEtapasInstrucoes(t.instrucoes);
    if (etapas.length === 0) {
      linhas.push(
        baseLinha(t, {
          descricao: `${t.tipoProtese} — Sem etapa`,
          colaborador: setorDaEtapa("", etapasCadastro),
        })
      );
      continue;
    }
    const valorEtapa = (Number(t.valor) || 0) / etapas.length;
    etapas.forEach((etapa, idx) => {
      const setor = setorDaEtapa(etapa.nome, etapasCadastro);
      linhas.push(
        baseLinha(t, {
          id: `${t.id}-setor-${idx}`,
          descricao: `${etapa.nome} — ${t.tipoProtese}`,
          colaborador: setor,
          valor: valorEtapa,
        })
      );
    });
  }
  return linhas;
}

function gerarCategoriasLista(
  trabalhos: TrabalhoRelatorioProducao[],
  categorias: CategoriaTabelaPrecoOs[]
) {
  return trabalhos.map((t) => {
    const cat = categoriaDoTrabalho(t, categorias);
    return baseLinha(t, {
      descricao: `${cat} — ${t.tipoProtese}`,
    });
  });
}

function gerarClientesLista(trabalhos: TrabalhoRelatorioProducao[]) {
  return trabalhos.map((t) => baseLinha(t));
}

export function gerarRelatorioProducao(
  trabalhos: TrabalhoRelatorioProducao[],
  filtros: FiltrosRelatorioProducao,
  contexto?: ContextoRelatorioProducao
): ResultadoRelatorioProducao {
  const etapasCadastro = contexto?.etapasCadastro ?? carregarEtapasCadastro();
  const categorias = contexto?.categoriasTabela ?? [];
  const base = filtrarTrabalhos(trabalhos, filtros);
  const opcao = filtros.opcaoRelatorio;

  let linhasDados: LinhaRelatorioProducao[] = [];

  switch (opcao) {
    case "servicos_lista":
      linhasDados = gerarServicosLista(base);
      break;
    case "servicos_agrupados":
      return {
        layout: "servicos_agrupados",
        linhas: gerarServicosAgrupadosResumo(base, filtros.ordenacao),
      };
    case "servicos_etapas":
      return {
        layout: "servicos_etapas",
        linhas: gerarServicosEtapasExpandivel(base, etapasCadastro, filtros.ordenacao),
      };
    case "colaboradores_lista":
      linhasDados = gerarColaboradoresLista(base);
      break;
    case "colaboradores_agrupados":
      linhasDados = gerarColaboradoresLista(base);
      linhasDados = ordenarLinhasDados(linhasDados, "cliente");
      return {
        layout: "detalhada",
        linhas: montarAgrupado(
          linhasDados,
          (l) => l.colaborador,
          (chave) => chave
        ),
      };
    case "setores_lista":
      linhasDados = gerarSetoresLista(base, etapasCadastro);
      break;
    case "setores_agrupados":
      linhasDados = gerarSetoresLista(base, etapasCadastro);
      return {
        layout: "detalhada",
        linhas: montarAgrupado(
          ordenarLinhasDados(linhasDados, filtros.ordenacao),
          (l) => l.colaborador,
          (chave) => `Setor: ${chave}`
        ),
      };
    case "categorias_lista":
      linhasDados = gerarCategoriasLista(base, categorias);
      break;
    case "categorias_agrupados":
      linhasDados = gerarCategoriasLista(base, categorias);
      return {
        layout: "detalhada",
        linhas: montarAgrupado(
          ordenarLinhasDados(linhasDados, filtros.ordenacao),
          (l) => {
            const partes = l.descricao.split(" — ");
            return partes[0] || l.descricao;
          },
          (chave) => chave
        ),
      };
    case "clientes_lista":
      linhasDados = gerarClientesLista(base);
      linhasDados.sort((a, b) => {
        const c = a.cliente.localeCompare(b.cliente, "pt-BR");
        if (c !== 0) return c;
        return Number(b.os) - Number(a.os);
      });
      return { layout: "detalhada", linhas: linhasDados };
    default:
      linhasDados = gerarServicosLista(base);
  }

  return {
    layout: "detalhada",
    linhas: ordenarLinhasDados(linhasDados, filtros.ordenacao),
  };
}

export function totaisRelatorioProducao(linhas: LinhaRelatorioProducao[]) {
  const dados = linhas.filter((l) => l.tipo === "dados");
  const qtd = dados.reduce((s, l) => s + Number(l.qtd || 0), 0);
  const valor = dados.reduce((s, l) => s + Number(l.valor || 0), 0);
  return { qtd, registros: dados.length, valor };
}

export function totaisRelatorioServicosEtapas(linhas: LinhaServicoEtapas[]) {
  const qtd = linhas.reduce((s, l) => s + l.qtd, 0);
  const valor = linhas.reduce((s, l) => s + l.valor, 0);
  return { qtd, registros: linhas.length, valor };
}

export function totaisDoResultadoRelatorio(resultado: ResultadoRelatorioProducao) {
  if (resultado.layout === "servicos_etapas") {
    return totaisRelatorioServicosEtapas(resultado.linhas);
  }
  return totaisRelatorioProducao(resultado.linhas);
}

export function formatarPercentualRelatorio(percentual: number) {
  return percentual.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function exportarRelatorioProducaoCsv(
  resultado: ResultadoRelatorioProducao,
  opcao?: OpcaoRelatorioProducao
) {
  const opcaoAtiva = opcao ?? (resultado.layout === "servicos_etapas" ? "servicos_etapas" : resultado.layout === "servicos_agrupados" ? "servicos_agrupados" : "servicos_lista");

  if (resultado.layout === "servicos_etapas") {
    const fmt = (n: number) =>
      n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const header =
      "Data;OS;Qtd;Descrição;Cor;Dente;Cliente;Paciente;Data Entregue;Situação;Valor;Etapa;Colaborador;Tempo (min);Situação Etapa";
    const rows: string[] = [];
    for (const linha of resultado.linhas) {
      if (linha.etapas.length === 0) {
        rows.push(
          `${linha.data};${linha.os};${linha.qtd};${linha.descricao};${linha.cor};${linha.dente};${linha.cliente};${linha.paciente};${linha.dataEntregue};${linha.situacao};${fmt(linha.valor)};;;;`
        );
        continue;
      }
      for (const etapa of linha.etapas) {
        rows.push(
          `${linha.data};${linha.os};${linha.qtd};${linha.descricao};${linha.cor};${linha.dente};${linha.cliente};${linha.paciente};${linha.dataEntregue};${linha.situacao};${fmt(linha.valor)};${etapa.etapa};${etapa.colaborador};${etapa.tempoMinutos};${etapa.situacao}`
        );
      }
    }
    const csv = ["\uFEFF", header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-producao-etapas.csv";
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const linhas = resultado.linhas;
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (opcaoAtiva === "servicos_agrupados") {
    const header = "Quantidade;Descrição;%;Valor";
    const rows = linhas
      .filter((l) => l.tipo === "dados")
      .map(
        (l) =>
          `${l.qtd};${l.descricao};${formatarPercentualRelatorio(l.percentual ?? 0)};${typeof l.valor === "number" ? fmt(l.valor) : ""}`
      );
    const csv = ["\uFEFF", header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-producao-servicos-agrupados.csv";
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const header =
    "Data;OS;Qtd;Descrição;Cor;Dente;Cliente;Paciente;Colaborador;Situação;Valor";
  const rows = linhas.map((l) => {
    if (l.tipo === "grupo") {
      return `${l.descricao};;;;;;;;;`;
    }
    if (l.tipo === "subtotal") {
      return `Subtotal;${l.os};${l.qtd};;;;;;;${typeof l.valor === "number" ? fmt(l.valor) : ""}`;
    }
    return `${l.data};${l.os};${l.qtd};${l.descricao};${l.cor};${l.dente};${l.cliente};${l.paciente};${l.colaborador};${l.situacao};${typeof l.valor === "number" ? fmt(l.valor) : ""}`;
  });
  const csv = ["\uFEFF", header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorio-producao.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** @deprecated use gerarRelatorioProducao */
export function filtrarLinhasRelatorioProducao(
  trabalhos: TrabalhoRelatorioProducao[],
  filtros: FiltrosRelatorioProducao
) {
  const resultado = gerarRelatorioProducao(trabalhos, filtros);
  return resultado.layout === "servicos_etapas" ? [] : resultado.linhas;
}

/** @deprecated */
export function trabalhoParaLinhaRelatorio(t: TrabalhoRelatorioProducao): LinhaRelatorioProducao {
  return baseLinha(t);
}
