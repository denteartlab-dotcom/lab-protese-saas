import { prisma } from "@/lib/db";
import { calcularStats, criarPontoChart } from "@/components/modulo-tv/mock-data";
import { COLUNAS_KANBAN } from "@/components/modulo-tv/constants";
import type {
  ColaboradorTv,
  ColunaKanbanId,
  OrdemServicoTv,
  PrioridadeOs,
  TvOrdensResponse,
  TvOsResumo,
} from "@/components/modulo-tv/types";
import {
  parseComplementosInstrucoesGrupo,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import { isTrabalhoAtrasado } from "@/lib/controle-producao-prazos";
import {
  lerJsonStoreTenant,
  salvarJsonStoreTenant,
} from "@/lib/json-store-tenant";
import {
  contextoEtapasModuloOsGrupo,
  escolherTrabalhoServicoGrupoOs,
  flagsUrgenciaTrabalho,
  itensDaOsModulo,
  itensDoGrupoOs,
  type TrabalhoModuloOs,
} from "@/lib/modulo-producao-os";
import {
  parsePrioridadeOsInstrucoes,
  prioridadeOsFormParaTv,
} from "@/lib/prioridade-os";
import { colunaTvPorNomeServico } from "@/lib/tv/tv-servico-coluna";
import {
  indiceEtapaAtualDeConcluidas,
  MODULO_PRODUCAO_ETAPAS_STORAGE_KEY,
} from "@/lib/modulo-producao-etapas";
import { registrarMudancaIndiceEtapa } from "@/lib/historico-etapas";
import { labelStatusOs, trabalhoVisivelModuloTv } from "@/lib/status-os";
import {
  adicionarTrabalhoControleEntregasAutomaticoServidor,
  deveAdicionarControleEntregasPorStatus,
  deveRemoverControleEntregasPorStatus,
  removerTrabalhoControleEntregasAutomaticoServidor,
} from "@/lib/controle-entregas-automatico";
import { normalizarColaborador } from "@/lib/utils";
import { listarUsuariosOnlineEmpresa } from "@/lib/presenca-usuarios";

const STATUS_VISIVEIS_TV = ["producao", "processando"] as const;

type MapaEtapasConcluidas = Record<string, number[]>;

type TrabalhoTvRow = {
  id: string;
  numeroOs: number;
  segmentoFaturamento: string;
  grupoOsId: string | null;
  tipoProtese: string;
  status: string;
  instrucoes: string | null;
  dataEntrada: Date;
  dataPrevista: Date | null;
  updatedAt: Date;
  cliente: { nome: string };
  paciente: { nome: string };
};

type ColaboradorCadastro = {
  id: string;
  nome: string;
};

function normalizarTexto(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const ORDEM_COLUNAS_KANBAN: ColunaKanbanId[] = [
  "entrada",
  "plano_cera",
  "montagem",
  "acrilizacao",
  "acabamento",
  "pronto_entrega",
];

export function mapearNomeEtapaParaColuna(
  nome: string,
  opts?: { indice?: number; totalEtapas?: number }
): ColunaKanbanId {
  const n = normalizarTexto(nome);

  for (const col of COLUNAS_KANBAN) {
    const label = normalizarTexto(col.label).replace(/\s*\/\s*/g, " ");
    if (n.includes(label) || label.includes(n)) return col.id;
    const tokens = label.split(/\s+/).filter((token) => token.length > 2);
    if (tokens.some((token) => n.includes(token))) return col.id;
  }

  if (/entrada|receb|triagem|pedido/.test(n)) return "entrada";
  if (/plano|cera|modelo|wax|individual|planej/.test(n)) return "plano_cera";
  if (/montagem/.test(n)) return "montagem";
  if (/acriliz|acrilic|polimer|caracteriz/.test(n)) return "acrilizacao";
  if (/acabamento|polimento|pigment|revisao|prova/.test(n)) return "acabamento";
  if (/pronto|entrega|final|retirada/.test(n)) return "pronto_entrega";

  if (opts?.indice != null) {
    const total = opts.totalEtapas ?? 0;
    if (total > 1) {
      const ratio = opts.indice / (total - 1);
      const slot = Math.round(ratio * (ORDEM_COLUNAS_KANBAN.length - 1));
      return ORDEM_COLUNAS_KANBAN[Math.min(Math.max(slot, 0), ORDEM_COLUNAS_KANBAN.length - 1)];
    }
    return ORDEM_COLUNAS_KANBAN[Math.min(opts.indice, ORDEM_COLUNAS_KANBAN.length - 1)];
  }

  return "entrada";
}

function colunaPorStatus(status: string): ColunaKanbanId {
  const s = status.toLowerCase();
  if (s === "saiu_entrega") return "pronto_entrega";
  if (s === "prova") return "acabamento";
  if (s === "producao") return "montagem";
  if (s === "pedido" || s === "pendente" || s === "recebido") return "entrada";
  return "entrada";
}

function prioridadeDeTrabalho(trabalho: TrabalhoModuloOs): PrioridadeOs {
  const explicita = parsePrioridadeOsInstrucoes(trabalho.instrucoes);
  if (explicita) return prioridadeOsFormParaTv(explicita);

  const { urgente, repeticao } = flagsUrgenciaTrabalho(trabalho);
  if (urgente) return "urgente";
  if (repeticao) return "alta";
  if (trabalho.status === "prova") return "alta";
  return "normal";
}

function formatarPrazoBr(date: Date | null | undefined, fallback: Date) {
  const alvo = date && !Number.isNaN(date.getTime()) ? date : fallback;
  return alvo.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function chaveItemModulo(trabalhoId: string, itemId: string) {
  return `${trabalhoId}:${itemId}`;
}

function resolverColunaAtual(
  trabalho: TrabalhoTvRow,
  etapas: EtapaOsLinha[],
  mapaConcluidas: MapaEtapasConcluidas
): { coluna: ColunaKanbanId; etapaAtual?: EtapaOsLinha; itemChave: string } {
  const moduloOs: TrabalhoModuloOs = {
    id: trabalho.id,
    numeroOs: trabalho.numeroOs,
    tipoProtese: trabalho.tipoProtese,
    valor: 0,
    status: trabalho.status,
    instrucoes: trabalho.instrucoes,
    dataEntrada: trabalho.dataEntrada.toISOString(),
    dataPrevista: trabalho.dataPrevista?.toISOString() ?? null,
    cliente: trabalho.cliente,
    paciente: trabalho.paciente,
  };

  const itens = itensDaOsModulo(moduloOs);
  const itemId =
    itens.find((item) => item.tipo === "trabalho")?.id ??
    itens[0]?.id ??
    `${trabalho.id}-principal`;
  const itemChave = chaveItemModulo(trabalho.id, itemId);
  const concluidas = new Set(mapaConcluidas[itemChave] ?? []);

  if (trabalho.status === "saiu_entrega") {
    return { coluna: "pronto_entrega", itemChave };
  }

  const colunaFixaServico = colunaTvPorNomeServico(trabalho.tipoProtese);
  if (colunaFixaServico) {
    if (etapas.length > 0) {
      const todasConcluidas = etapas.every((_, i) => concluidas.has(i));
      if (todasConcluidas) {
        return { coluna: "pronto_entrega", itemChave };
      }
      const indiceAtual = etapas.findIndex((_, i) => !concluidas.has(i));
      return {
        coluna: colunaFixaServico,
        etapaAtual: indiceAtual >= 0 ? etapas[indiceAtual] : undefined,
        itemChave,
      };
    }
    return { coluna: colunaFixaServico, itemChave };
  }

  if (etapas.length === 0) {
    return { coluna: colunaPorStatus(trabalho.status), itemChave };
  }

  for (let i = 0; i < etapas.length; i++) {
    const etapa = etapas[i];
    if (!concluidas.has(i)) {
      return {
        coluna: mapearNomeEtapaParaColuna(etapa.nome, {
          indice: i,
          totalEtapas: etapas.length,
        }),
        etapaAtual: etapa,
        itemChave,
      };
    }
  }

  return { coluna: "pronto_entrega", itemChave };
}

function trabalhoParaOrdem(
  trabalho: TrabalhoTvRow,
  etapasGrupo: EtapaOsLinha[],
  mapaConcluidas: MapaEtapasConcluidas,
  colaboradoresCadastro: ColaboradorCadastro[],
  instrucoesGrupo: string[] = []
) {
  const moduloOs: TrabalhoModuloOs = {
    id: trabalho.id,
    numeroOs: trabalho.numeroOs,
    tipoProtese: trabalho.tipoProtese,
    valor: 0,
    status: trabalho.status,
    instrucoes: trabalho.instrucoes,
    dataEntrada: trabalho.dataEntrada.toISOString(),
    dataPrevista: trabalho.dataPrevista?.toISOString() ?? null,
    cliente: trabalho.cliente,
    paciente: trabalho.paciente,
  };

  const { coluna, etapaAtual } = resolverColunaAtual(
    trabalho,
    etapasGrupo,
    mapaConcluidas
  );

  const prazoDate = trabalho.dataPrevista ?? trabalho.dataEntrada;
  const atrasada = isTrabalhoAtrasado({
    status: trabalho.status,
    dataEntrada: trabalho.dataEntrada,
    dataPrevista: trabalho.dataPrevista?.toISOString() ?? null,
    instrucoes: trabalho.instrucoes,
  });

  const nomeResp = normalizarColaborador(etapaAtual?.responsavel);
  const colabCadastro = nomeResp
    ? colaboradoresCadastro.find(
        (c) => c.nome.trim().toLowerCase() === nomeResp.toLowerCase()
      )
    : undefined;
  const colab = colabCadastro
    ? { id: colabCadastro.id, nome: colabCadastro.nome }
    : nomeResp
      ? { id: `resp-${nomeResp}`, nome: nomeResp }
      : { id: "", nome: "" };

  const statusLabel = etapaAtual
    ? `${etapaAtual.nome}${nomeResp ? ` · ${nomeResp}` : ""}`
    : labelStatusOs(trabalho.status);

  return {
    id: trabalho.id,
    numeroOs: trabalho.numeroOs,
    paciente: trabalho.paciente.nome,
    dentista: trabalho.cliente.nome,
    colaborador: colab.nome,
    colaboradorId: colab.id,
    prioridade: prioridadeDeTrabalho({
      ...moduloOs,
      instrucoes: instrucoesGrupo.filter(Boolean).join("\n") || moduloOs.instrucoes,
    }),
    prazo: formatarPrazoBr(trabalho.dataPrevista, trabalho.dataEntrada),
    prazoIso: (trabalho.dataPrevista ?? trabalho.dataEntrada).toISOString(),
    status: statusLabel,
    coluna,
    atrasada,
    etapaDesde: trabalho.updatedAt.toISOString(),
  };
}

function escolherTrabalhoPrincipal(grupo: TrabalhoTvRow[]) {
  return escolherTrabalhoServicoGrupoOs(grupo);
}

export async function carregarColaboradoresTv(
  empresaId: string
): Promise<ColaboradorTv[]> {
  const [cadastro, usuariosOnline] = await Promise.all([
    lerJsonStoreTenant<ColaboradorCadastro[]>(empresaId, "labProteseColaboradores"),
    Promise.resolve(listarUsuariosOnlineEmpresa(empresaId)),
  ]);

  const colaboradoresCadastro = (cadastro ?? []).filter((c) => c?.nome?.trim());
  const idsOnline = new Set<string>();
  const nomesOnline = new Set<string>();

  for (const usuario of usuariosOnline) {
    if (usuario.colaboradorId?.trim()) {
      idsOnline.add(usuario.colaboradorId.trim());
    }
    const nome = (usuario.colaboradorNome || usuario.name || "").trim().toLowerCase();
    if (nome) nomesOnline.add(nome);
  }

  const resultado: ColaboradorTv[] = [];
  const idsIncluidos = new Set<string>();

  for (const usuario of usuariosOnline) {
    const colabId = usuario.colaboradorId?.trim();
    const nomeExibicao =
      (colabId
        ? colaboradoresCadastro.find((c) => c.id === colabId)?.nome
        : null) ||
      usuario.colaboradorNome?.trim() ||
      usuario.name.trim();

    const id = colabId || `user-${usuario.userId}`;
    if (idsIncluidos.has(id)) continue;
    idsIncluidos.add(id);

    resultado.push({
      id,
      nome: nomeExibicao,
      online: true,
    });
  }

  for (const colaborador of colaboradoresCadastro) {
    if (idsIncluidos.has(colaborador.id)) continue;
    resultado.push({
      id: colaborador.id,
      nome: colaborador.nome,
      online:
        idsOnline.has(colaborador.id) ||
        nomesOnline.has(colaborador.nome.trim().toLowerCase()),
    });
  }

  return resultado.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export async function carregarOrdensTv(
  empresaId: string
): Promise<TvOrdensResponse> {
  const [trabalhos, mapaConcluidas, colaboradores] = await Promise.all([
    prisma.trabalho.findMany({
      where: {
        empresaId,
        status: { in: [...STATUS_VISIVEIS_TV] },
      },
      orderBy: [{ numeroOs: "desc" }, { createdAt: "desc" }],
      include: {
        cliente: { select: { nome: true } },
        paciente: { select: { nome: true } },
      },
    }) as Promise<TrabalhoTvRow[]>,
    lerJsonStoreTenant<MapaEtapasConcluidas>(
      empresaId,
      MODULO_PRODUCAO_ETAPAS_STORAGE_KEY
    ),
    lerJsonStoreTenant<ColaboradorCadastro[]>(empresaId, "labProteseColaboradores"),
  ]);

  const mapa = mapaConcluidas ?? {};
  const colabCadastro = colaboradores ?? [];

  const porNumero = new Map<number, TrabalhoTvRow[]>();
  for (const t of trabalhos) {
    const lista = porNumero.get(t.numeroOs) ?? [];
    lista.push(t);
    porNumero.set(t.numeroOs, lista);
  }

  const ordens: OrdemServicoTv[] = [];

  for (const grupo of porNumero.values()) {
    const principal = escolherTrabalhoPrincipal(grupo);
    if (!trabalhoVisivelModuloTv(principal.status)) continue;

    const instrucoesGrupo = grupo.map((t) => t.instrucoes || "");
    const { etapas } = parseComplementosInstrucoesGrupo(instrucoesGrupo);

    ordens.push(
      trabalhoParaOrdem(principal, etapas, mapa, colabCadastro, instrucoesGrupo)
    );
  }

  ordens.sort((a, b) => b.numeroOs - a.numeroOs);

  const colaboradoresTv = await carregarColaboradoresTv(empresaId);
  const stats = calcularStats(ordens);
  stats.colaboradoresOnline = colaboradoresTv.filter((c) => c.online).length;

  return {
    ordens,
    colaboradores: colaboradoresTv,
    stats,
    ultimaAtualizacao: new Date().toISOString(),
  };
}

/** Índices de etapas a marcar como concluídas ao mover para uma coluna. */
function indicesEtapasAteColuna(
  etapas: EtapaOsLinha[],
  colunaAlvo: ColunaKanbanId
): number[] {
  if (colunaAlvo === "entrada") return [];
  if (colunaAlvo === "pronto_entrega") {
    return etapas.map((_, i) => i);
  }

  const indices: number[] = [];
  for (let i = 0; i < etapas.length; i++) {
    const etapa = etapas[i];
    const col = mapearNomeEtapaParaColuna(etapa.nome, {
      indice: i,
      totalEtapas: etapas.length,
    });
    if (col === colunaAlvo) break;
    indices.push(i);
  }
  return indices;
}

export async function moverTrabalhoTvColuna(
  trabalhoId: string,
  coluna: ColunaKanbanId,
  empresaId: string
): Promise<TvOrdensResponse | null> {
  const trabalho = await prisma.trabalho.findFirst({
    where: { id: trabalhoId, empresaId },
    include: {
      cliente: {
        select: {
          nome: true,
          endereco: true,
          cidade: true,
          uf: true,
          cep: true,
          observacoes: true,
        },
      },
      paciente: { select: { nome: true } },
    },
  });

  if (!trabalho) return null;

  const grupo = await prisma.trabalho.findMany({
    where: {
      empresaId,
      OR: [
        { id: trabalhoId },
        ...(trabalho.grupoOsId
          ? [{ grupoOsId: trabalho.grupoOsId }]
          : [{ numeroOs: trabalho.numeroOs }]),
      ],
    },
  });

  const trabalhosGrupo: TrabalhoModuloOs[] = grupo.map((t) => ({
    id: t.id,
    numeroOs: t.numeroOs,
    tipoProtese: t.tipoProtese,
    valor: t.valor,
    status: t.status,
    instrucoes: t.instrucoes,
    dataEntrada: t.dataEntrada.toISOString(),
    dataPrevista: t.dataPrevista?.toISOString() ?? null,
    segmentoFaturamento: t.segmentoFaturamento,
  }));

  const { etapas, trabalhoId: idServicoPrincipal, itemId } =
    contextoEtapasModuloOsGrupo(trabalhosGrupo);
  const chave = chaveItemModulo(idServicoPrincipal, itemId);

  const mapa =
    (await lerJsonStoreTenant<MapaEtapasConcluidas>(
      empresaId,
      MODULO_PRODUCAO_ETAPAS_STORAGE_KEY
    )) ?? {};

  const concluidasAnteriores = mapa[chave] ?? [];
  const indiceAnterior = etapas.length
    ? indiceEtapaAtualDeConcluidas(concluidasAnteriores, etapas.length)
    : 0;

  if (etapas.length > 0) {
    mapa[chave] = indicesEtapasAteColuna(etapas, coluna);
  }

  const indiceNovo = etapas.length
    ? indiceEtapaAtualDeConcluidas(mapa[chave] ?? [], etapas.length)
    : 0;

  const novoStatus =
    coluna === "pronto_entrega"
      ? "saiu_entrega"
      : trabalho.status === "saiu_entrega"
        ? "producao"
        : trabalho.status === "pedido" || trabalho.status === "pendente"
          ? "producao"
          : trabalho.status;

  const payloadStatus: { status: string; dataEntrega?: Date } = { status: novoStatus };
  if (novoStatus === "saiu_entrega" && !trabalho.dataEntrega) {
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    payloadStatus.dataEntrega = hoje;
  }

  await Promise.all([
    salvarJsonStoreTenant(empresaId, MODULO_PRODUCAO_ETAPAS_STORAGE_KEY, mapa),
    prisma.trabalho.update({
      where: { id: trabalhoId },
      data: payloadStatus,
    }),
    indiceAnterior !== indiceNovo
      ? registrarMudancaIndiceEtapa({
          trabalhoId: idServicoPrincipal,
          itemId,
          indiceAnterior,
          indiceNovo,
          colaboradorNome: etapas[indiceNovo]?.responsavel ?? null,
          motivoRetorno:
            indiceNovo < indiceAnterior ? "Retorno de etapa (TV)" : null,
        })
      : Promise.resolve(),
  ]);

  if (deveRemoverControleEntregasPorStatus(trabalho.status, novoStatus)) {
    try {
      await removerTrabalhoControleEntregasAutomaticoServidor(
        empresaId,
        trabalho.numeroOs
      );
    } catch (err) {
      console.warn("[tv] remoção controle entregas automático", err);
    }
  } else if (deveAdicionarControleEntregasPorStatus(trabalho.status, novoStatus)) {
    try {
      await adicionarTrabalhoControleEntregasAutomaticoServidor(empresaId, {
        id: trabalho.id,
        numeroOs: trabalho.numeroOs,
        tipoProtese: trabalho.tipoProtese,
        valor: trabalho.valor,
        cliente: trabalho.cliente,
      }, { origem: "status" });
    } catch (err) {
      console.warn("[tv] controle entregas automático", err);
    }
  }

  return carregarOrdensTv(empresaId);
}

export function snapshotParaChart(ordens: OrdemServicoTv[]) {
  return criarPontoChart(ordens);
}

function labelColunaKanban(coluna: ColunaKanbanId) {
  return COLUNAS_KANBAN.find((c) => c.id === coluna)?.label ?? coluna;
}

export async function carregarResumoOsTv(
  trabalhoId: string,
  empresaId: string
): Promise<TvOsResumo | null> {
  const trabalho = await prisma.trabalho.findFirst({
    where: { id: trabalhoId, empresaId },
    include: {
      cliente: { select: { nome: true } },
      paciente: { select: { nome: true } },
    },
  });

  if (!trabalho) return null;

  const grupo = await prisma.trabalho.findMany({
    where: {
      empresaId,
      OR: [
        { id: trabalhoId },
        ...(trabalho.grupoOsId
          ? [{ grupoOsId: trabalho.grupoOsId }]
          : [{ numeroOs: trabalho.numeroOs }]),
      ],
    },
    include: {
      cliente: { select: { nome: true } },
      paciente: { select: { nome: true } },
    },
    orderBy: { segmentoFaturamento: "asc" },
  });

  const principal =
    grupo.find((t) => t.segmentoFaturamento === "servico") ?? grupo[0];
  const instrucoesGrupo = grupo.map((t) => t.instrucoes || "");
  const { etapas } = parseComplementosInstrucoesGrupo(instrucoesGrupo);

  const mapa =
    (await lerJsonStoreTenant<MapaEtapasConcluidas>(
      empresaId,
      MODULO_PRODUCAO_ETAPAS_STORAGE_KEY
    )) ?? {};

  const colaboradores =
    (await lerJsonStoreTenant<ColaboradorCadastro[]>(
      empresaId,
      "labProteseColaboradores"
    )) ?? [];

  const principalTv: TrabalhoTvRow = {
    id: principal.id,
    numeroOs: principal.numeroOs,
    segmentoFaturamento: principal.segmentoFaturamento,
    grupoOsId: principal.grupoOsId,
    tipoProtese: principal.tipoProtese,
    status: principal.status,
    instrucoes: principal.instrucoes,
    dataEntrada: principal.dataEntrada,
    dataPrevista: principal.dataPrevista,
    updatedAt: principal.updatedAt,
    cliente: principal.cliente,
    paciente: principal.paciente,
  };

  const { coluna, etapaAtual, itemChave } = resolverColunaAtual(
    principalTv,
    etapas,
    mapa
  );

  const concluidas = new Set(mapa[itemChave] ?? []);
  const indiceAtual =
    etapas.length > 0
      ? indiceEtapaAtualDeConcluidas(concluidas, etapas.length)
      : null;

  const moduloOs: TrabalhoModuloOs = {
    id: principal.id,
    numeroOs: principal.numeroOs,
    tipoProtese: principal.tipoProtese,
    valor: principal.valor,
    status: principal.status,
    dentes: principal.dentes,
    cor: principal.cor,
    material: principal.material,
    observacoes: principal.observacoes,
    instrucoes: principal.instrucoes,
    dataEntrada: principal.dataEntrada.toISOString(),
    dataPrevista: principal.dataPrevista?.toISOString() ?? null,
    cliente: principal.cliente,
    paciente: principal.paciente,
  };

  const { urgente, repeticao } = flagsUrgenciaTrabalho(moduloOs);
  const prioridade = prioridadeDeTrabalho({
    ...moduloOs,
    instrucoes: instrucoesGrupo.filter(Boolean).join("\n") || moduloOs.instrucoes,
  });
  const atrasada = isTrabalhoAtrasado({
    status: principal.status,
    dataEntrada: principal.dataEntrada,
    dataPrevista: principal.dataPrevista?.toISOString() ?? null,
    instrucoes: principal.instrucoes,
  });

  const nomeResp = normalizarColaborador(etapaAtual?.responsavel);
  const colabCadastro = nomeResp
    ? colaboradores.find(
        (c) => c.nome.trim().toLowerCase() === nomeResp.toLowerCase()
      )
    : undefined;
  const colab = colabCadastro
    ? { id: colabCadastro.id, nome: colabCadastro.nome }
    : nomeResp
      ? { id: `resp-${nomeResp}`, nome: nomeResp }
      : { id: "", nome: "" };

  const statusLabel = etapaAtual
    ? `${etapaAtual.nome}${nomeResp ? ` · ${nomeResp}` : ""}`
    : labelStatusOs(principal.status);

  const trabalhosModulo: TrabalhoModuloOs[] = grupo.map((t) => ({
    id: t.id,
    numeroOs: t.numeroOs,
    tipoProtese: t.tipoProtese,
    valor: t.valor,
    status: t.status,
    dentes: t.dentes,
    cor: t.cor,
    material: t.material,
    observacoes: t.observacoes,
    instrucoes: t.instrucoes,
    dataEntrada: t.dataEntrada.toISOString(),
    dataPrevista: t.dataPrevista?.toISOString() ?? null,
    cliente: t.cliente,
    paciente: t.paciente,
  }));

  const itens = itensDoGrupoOs(trabalhosModulo).map((item) => ({
    descricao: item.descricao,
    qtd: item.qtd,
    situacao: item.situacao,
  }));

  return {
    id: principal.id,
    numeroOs: principal.numeroOs,
    paciente: principal.paciente.nome,
    dentista: principal.cliente.nome,
    tipoProtese: principal.tipoProtese,
    dentes: principal.dentes?.trim() || "—",
    cor: principal.cor?.trim() || "—",
    material: principal.material?.trim() || "—",
    prioridade,
    atrasada,
    urgente,
    repeticao,
    coluna,
    colunaLabel: labelColunaKanban(coluna),
    status: statusLabel,
    statusOs: labelStatusOs(principal.status),
    colaborador: colab.nome,
    prazo: formatarPrazoBr(
      principal.dataPrevista,
      principal.dataEntrada
    ),
    dataEntrada: principal.dataEntrada.toLocaleDateString("pt-BR"),
    dataPrevista: principal.dataPrevista
      ? principal.dataPrevista.toLocaleDateString("pt-BR")
      : null,
    observacoes: principal.observacoes?.trim() || "",
    itens,
    etapas: etapas.map((etapa, i) => ({
      indice: i,
      nome: etapa.nome,
      responsavel: normalizarColaborador(etapa.responsavel),
      prazo: etapa.prazo?.trim() || "—",
      concluida: concluidas.has(i),
      atual: indiceAtual === i,
    })),
  };
}
