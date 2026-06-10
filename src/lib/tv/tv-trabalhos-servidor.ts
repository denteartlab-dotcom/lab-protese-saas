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
import { lerJsonStoreServidor } from "@/lib/json-store-servidor";
import {
  flagsUrgenciaTrabalho,
  itensDaOsModulo,
  itensDoGrupoOs,
  type TrabalhoModuloOs,
} from "@/lib/modulo-producao-os";
import { labelStatusOs } from "@/lib/status-os";
import { normalizarColaborador } from "@/lib/utils";

const STATUS_ATIVOS_EXCLUIDOS = ["cancelado", "entregue", "finalizado"];

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

export function mapearNomeEtapaParaColuna(nome: string): ColunaKanbanId {
  const n = normalizarTexto(nome);
  if (/entrada|receb|triagem|pedido/.test(n)) return "entrada";
  if (/plano|cera|modelo|wax|individual|planej/.test(n)) return "plano_cera";
  if (/montagem/.test(n)) return "montagem";
  if (/acriliz|acrilic|polimer|caracteriz/.test(n)) return "acrilizacao";
  if (/acabamento|polimento|pigment|revisao|prova/.test(n)) return "acabamento";
  if (/pronto|entrega|final|retirada/.test(n)) return "pronto_entrega";
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
  const item = itens[0];
  const itemChave = chaveItemModulo(trabalho.id, item.id);
  const concluidas = new Set(mapaConcluidas[itemChave] ?? []);

  if (trabalho.status === "saiu_entrega") {
    return { coluna: "pronto_entrega", itemChave };
  }

  if (etapas.length === 0) {
    return { coluna: colunaPorStatus(trabalho.status), itemChave };
  }

  for (const etapa of etapas) {
    if (!concluidas.has(etapa.indice)) {
      return {
        coluna: mapearNomeEtapaParaColuna(etapa.nome),
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
  colaboradoresCadastro: ColaboradorCadastro[]
): OrdemServicoTv {
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
    prioridade: prioridadeDeTrabalho(moduloOs),
    prazo: formatarPrazoBr(trabalho.dataPrevista, trabalho.dataEntrada),
    prazoIso: (trabalho.dataPrevista ?? trabalho.dataEntrada).toISOString(),
    status: statusLabel,
    coluna,
    atrasada,
    etapaDesde: trabalho.updatedAt.toISOString(),
  };
}

function escolherTrabalhoPrincipal(grupo: TrabalhoTvRow[]) {
  const servico = grupo.find((t) => t.segmentoFaturamento === "servico");
  return servico ?? grupo[0];
}

export async function carregarColaboradoresTv(): Promise<ColaboradorTv[]> {
  const [cadastro, usuariosModulo] = await Promise.all([
    lerJsonStoreServidor<ColaboradorCadastro[]>("labProteseColaboradores"),
    prisma.user.findMany({
      where: { excluidoEm: null, moduloProducao: true },
      select: { colaboradorId: true, colaboradorNome: true, name: true },
    }),
  ]);

  const idsOnline = new Set(
    usuariosModulo
      .map((u) => u.colaboradorId?.trim())
      .filter((id): id is string => Boolean(id))
  );
  const nomesOnline = new Set(
    usuariosModulo.map((u) =>
      (u.colaboradorNome || u.name || "").trim().toLowerCase()
    )
  );

  const lista = (cadastro ?? []).filter((c) => c?.nome?.trim());
  if (lista.length === 0) {
    return usuariosModulo.map((u) => ({
      id: u.colaboradorId || u.name,
      nome: u.colaboradorNome || u.name,
      online: true,
    }));
  }

  return lista.map((c) => ({
    id: c.id,
    nome: c.nome,
    online:
      idsOnline.has(c.id) ||
      nomesOnline.has(c.nome.trim().toLowerCase()),
  }));
}

export async function carregarOrdensTv(): Promise<TvOrdensResponse> {
  const [trabalhos, mapaConcluidas, colaboradores] = await Promise.all([
    prisma.trabalho.findMany({
      where: { status: { notIn: STATUS_ATIVOS_EXCLUIDOS } },
      orderBy: [{ numeroOs: "desc" }, { createdAt: "desc" }],
      include: {
        cliente: { select: { nome: true } },
        paciente: { select: { nome: true } },
      },
    }) as Promise<TrabalhoTvRow[]>,
    lerJsonStoreServidor<MapaEtapasConcluidas>(
      "labProteseModuloProducaoEtapas"
    ),
    lerJsonStoreServidor<ColaboradorCadastro[]>("labProteseColaboradores"),
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
    const instrucoesGrupo = grupo.map((t) => t.instrucoes || "");
    const { etapas } = parseComplementosInstrucoesGrupo(instrucoesGrupo);

    ordens.push(
      trabalhoParaOrdem(principal, etapas, mapa, colabCadastro)
    );
  }

  ordens.sort((a, b) => b.numeroOs - a.numeroOs);

  const colaboradoresTv = await carregarColaboradoresTv();
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
    return etapas.map((e) => e.indice);
  }

  const indices: number[] = [];
  for (const etapa of etapas) {
    const col = mapearNomeEtapaParaColuna(etapa.nome);
    if (col === colunaAlvo) break;
    indices.push(etapa.indice);
  }
  return indices;
}

export async function moverTrabalhoTvColuna(
  trabalhoId: string,
  coluna: ColunaKanbanId
): Promise<TvOrdensResponse | null> {
  const trabalho = await prisma.trabalho.findUnique({
    where: { id: trabalhoId },
    include: {
      cliente: { select: { nome: true } },
      paciente: { select: { nome: true } },
    },
  });

  if (!trabalho) return null;

  const grupo = await prisma.trabalho.findMany({
    where: {
      OR: [
        { id: trabalhoId },
        ...(trabalho.grupoOsId
          ? [{ grupoOsId: trabalho.grupoOsId }]
          : [{ numeroOs: trabalho.numeroOs }]),
      ],
    },
  });

  const instrucoesGrupo = grupo.map((t) => t.instrucoes || "");
  const { etapas } = parseComplementosInstrucoesGrupo(instrucoesGrupo);

  const moduloOs: TrabalhoModuloOs = {
    id: trabalho.id,
    numeroOs: trabalho.numeroOs,
    tipoProtese: trabalho.tipoProtese,
    valor: trabalho.valor,
    status: trabalho.status,
    instrucoes: trabalho.instrucoes,
    dataEntrada: trabalho.dataEntrada.toISOString(),
    dataPrevista: trabalho.dataPrevista?.toISOString() ?? null,
    cliente: trabalho.cliente,
    paciente: trabalho.paciente,
  };

  const item = itensDaOsModulo(moduloOs)[0];
  const chave = chaveItemModulo(trabalho.id, item.id);

  const mapa =
    (await lerJsonStoreServidor<MapaEtapasConcluidas>(
      "labProteseModuloProducaoEtapas"
    )) ?? {};

  if (etapas.length > 0) {
    mapa[chave] = indicesEtapasAteColuna(etapas, coluna);
  }

  const novoStatus =
    coluna === "pronto_entrega"
      ? "saiu_entrega"
      : trabalho.status === "saiu_entrega"
        ? "producao"
        : trabalho.status === "pedido" || trabalho.status === "pendente"
          ? "producao"
          : trabalho.status;

  await Promise.all([
    prisma.jsonStore.upsert({
      where: { key: "labProteseModuloProducaoEtapas" },
      create: {
        key: "labProteseModuloProducaoEtapas",
        payload: JSON.stringify(mapa),
      },
      update: { payload: JSON.stringify(mapa) },
    }),
    prisma.trabalho.update({
      where: { id: trabalhoId },
      data: { status: novoStatus },
    }),
  ]);

  return carregarOrdensTv();
}

export function snapshotParaChart(ordens: OrdemServicoTv[]) {
  return criarPontoChart(ordens);
}

function labelColunaKanban(coluna: ColunaKanbanId) {
  return COLUNAS_KANBAN.find((c) => c.id === coluna)?.label ?? coluna;
}

export async function carregarResumoOsTv(
  trabalhoId: string
): Promise<TvOsResumo | null> {
  const trabalho = await prisma.trabalho.findUnique({
    where: { id: trabalhoId },
    include: {
      cliente: { select: { nome: true } },
      paciente: { select: { nome: true } },
    },
  });

  if (!trabalho) return null;

  const grupo = await prisma.trabalho.findMany({
    where: {
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
    (await lerJsonStoreServidor<MapaEtapasConcluidas>(
      "labProteseModuloProducaoEtapas"
    )) ?? {};

  const colaboradores =
    (await lerJsonStoreServidor<ColaboradorCadastro[]>(
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
  const indiceAtual = etapaAtual?.indice ?? null;

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
  const prioridade = prioridadeDeTrabalho(moduloOs);
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
    etapas: etapas.map((etapa) => ({
      indice: etapa.indice,
      nome: etapa.nome,
      responsavel: normalizarColaborador(etapa.responsavel),
      prazo: etapa.prazo?.trim() || "—",
      concluida: concluidas.has(etapa.indice),
      atual: indiceAtual === etapa.indice,
    })),
  };
}
