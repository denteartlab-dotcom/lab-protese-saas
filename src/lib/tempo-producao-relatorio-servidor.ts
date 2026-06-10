import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  localDate,
  prazoTrabalho,
  trabalhoAtivo,
} from "@/lib/controle-producao-prazos";
import {
  parseComplementosInstrucoesGrupo,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import { lerJsonStoreServidor } from "@/lib/json-store-servidor";
import {
  flagsUrgenciaTrabalho,
  itensDaOsModulo,
  type TrabalhoModuloOs,
} from "@/lib/modulo-producao-os";
import { prisma } from "@/lib/db";
import { trabalhoParaDetalheTempoProducao } from "@/lib/tempo-producao-detalhe";
import {
  calcularMetricasTempoProducao,
  enriquecerLinhaTempoProducao,
  formatarDataBr,
  type LinhaTempoProducao,
  type PrioridadeTempoProducao,
} from "@/lib/tempo-producao-relatorio";

const STATUS_ATIVOS_EXCLUIDOS = ["cancelado", "entregue", "finalizado"];

type MapaEtapasConcluidas = Record<string, number[]>;

type TrabalhoRow = {
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

function chaveItemModulo(trabalhoId: string, itemId: string) {
  return `${trabalhoId}:${itemId}`;
}

function resolverEtapaAtual(
  trabalho: TrabalhoRow,
  etapas: EtapaOsLinha[],
  mapaConcluidas: MapaEtapasConcluidas
): EtapaOsLinha | undefined {
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
  const item = itensDaOsModulo(moduloOs)[0];
  const chave = chaveItemModulo(trabalho.id, item.id);
  const concluidas = new Set(mapaConcluidas[chave] ?? []);
  for (const etapa of etapas) {
    if (!concluidas.has(etapa.indice)) return etapa;
  }
  return etapas[etapas.length - 1];
}

function prioridadeDeTrabalho(trabalho: TrabalhoModuloOs): PrioridadeTempoProducao {
  const { urgente, repeticao } = flagsUrgenciaTrabalho(trabalho);
  if (urgente) return "urgente";
  if (repeticao) return "alta";
  if (trabalho.status === "prova") return "alta";
  return "normal";
}

function escolherTrabalhoPrincipal(grupo: TrabalhoRow[]) {
  return grupo.find((t) => t.segmentoFaturamento === "servico") ?? grupo[0];
}

function trabalhoParaLinha(
  principal: TrabalhoRow,
  grupo: TrabalhoRow[],
  etapas: EtapaOsLinha[],
  mapaConcluidas: MapaEtapasConcluidas
): LinhaTempoProducao {
  const instrucoesGrupo = grupo.map((t) => t.instrucoes || "").join("\n");
  const moduloConsolidado: TrabalhoModuloOs = {
    id: principal.id,
    numeroOs: principal.numeroOs,
    tipoProtese: principal.tipoProtese,
    valor: 0,
    status: principal.status,
    instrucoes: instrucoesGrupo,
    dataEntrada: principal.dataEntrada.toISOString(),
    dataPrevista: principal.dataPrevista?.toISOString() ?? null,
    cliente: principal.cliente,
    paciente: principal.paciente,
  };

  const etapaAtual = resolverEtapaAtual(principal, etapas, mapaConcluidas);
  const prazoDate = prazoTrabalho(
    {
      status: principal.status,
      dataEntrada: principal.dataEntrada,
      dataPrevista: principal.dataPrevista?.toISOString() ?? null,
      instrucoes: instrucoesGrupo,
    },
    "lab"
  );

  const metricas = calcularMetricasTempoProducao({
    dataEntradaLab: principal.dataEntrada,
    dataEntradaEtapa: principal.updatedAt,
    prazo: prazoDate,
  });

  const ultimaMov = principal.updatedAt;

  return {
    id: principal.id,
    numeroOs: principal.numeroOs,
    paciente: principal.paciente.nome,
    dentista: principal.cliente.nome,
    tipoServico: principal.tipoProtese,
    etapaAtual: etapaAtual?.nome ?? "Sem etapa definida",
    colaborador: etapaAtual?.responsavel?.trim() || "—",
    dataEntradaLab: principal.dataEntrada.toISOString(),
    dataEntradaLabBr: formatarDataBr(principal.dataEntrada.toISOString()),
    dataEntradaEtapa: principal.updatedAt.toISOString(),
    dataEntradaEtapaBr: formatarDataBr(principal.updatedAt.toISOString()),
    prazoCombinado: prazoDate ? localDate(prazoDate).toISOString() : "",
    prazoCombinadoBr: prazoDate ? formatarDataBr(localDate(prazoDate).toISOString()) : "—",
    diasNoLaboratorio: metricas.diasNoLaboratorio,
    diasNaEtapaAtual: metricas.diasNaEtapaAtual,
    diasAtraso: metricas.diasAtraso,
    diasParaVencer: metricas.diasParaVencer,
    status: metricas.status,
    prioridade: prioridadeDeTrabalho(moduloConsolidado),
    ultimaMovimentacao: ultimaMov.toISOString(),
    ultimaMovimentacaoBr: format(ultimaMov, "dd/MM/yyyy HH:mm", { locale: ptBR }),
    responsavelPeloAtraso: "",
    paradoMuitoTempo: false,
  };
}

export async function carregarLinhasTempoProducaoServidor(): Promise<LinhaTempoProducao[]> {
  const [trabalhos, mapaConcluidas] = await Promise.all([
    prisma.trabalho.findMany({
      where: { status: { notIn: STATUS_ATIVOS_EXCLUIDOS } },
      orderBy: [{ numeroOs: "desc" }, { createdAt: "desc" }],
      include: {
        cliente: { select: { nome: true } },
        paciente: { select: { nome: true } },
      },
    }) as Promise<TrabalhoRow[]>,
    lerJsonStoreServidor<MapaEtapasConcluidas>("labProteseModuloProducaoEtapas"),
  ]);

  const mapa = mapaConcluidas ?? {};
  const porNumero = new Map<number, TrabalhoRow[]>();

  for (const t of trabalhos) {
    if (!trabalhoAtivo(t.status)) continue;
    const lista = porNumero.get(t.numeroOs) ?? [];
    lista.push(t);
    porNumero.set(t.numeroOs, lista);
  }

  const linhas: LinhaTempoProducao[] = [];
  for (const grupo of porNumero.values()) {
    const principal = escolherTrabalhoPrincipal(grupo);
    const instrucoesGrupo = grupo.map((t) => t.instrucoes || "");
    const { etapas } = parseComplementosInstrucoesGrupo(instrucoesGrupo);
    linhas.push(enriquecerLinhaTempoProducao(trabalhoParaLinha(principal, grupo, etapas, mapa)));
  }

  return linhas;
}

export async function carregarDetalheTempoProducaoServidor(trabalhoId: string) {
  const [trabalho, mapaConcluidas] = await Promise.all([
    prisma.trabalho.findFirst({
      where: { id: trabalhoId },
      include: {
        cliente: { select: { nome: true } },
        paciente: { select: { nome: true } },
      },
    }) as Promise<TrabalhoRow | null>,
    lerJsonStoreServidor<MapaEtapasConcluidas>("labProteseModuloProducaoEtapas"),
  ]);

  if (!trabalho) return null;

  const grupo = (await prisma.trabalho.findMany({
    where: { numeroOs: trabalho.numeroOs },
    include: {
      cliente: { select: { nome: true } },
      paciente: { select: { nome: true } },
    },
  })) as TrabalhoRow[];

  const principal = escolherTrabalhoPrincipal(grupo);
  const instrucoesGrupo = grupo.map((t) => t.instrucoes || "");
  const { etapas } = parseComplementosInstrucoesGrupo(instrucoesGrupo);
  const item = itensDaOsModulo({
    id: principal.id,
    numeroOs: principal.numeroOs,
    tipoProtese: principal.tipoProtese,
    valor: 0,
    status: principal.status,
    instrucoes: instrucoesGrupo.join("\n"),
    dataEntrada: principal.dataEntrada.toISOString(),
    dataPrevista: principal.dataPrevista?.toISOString() ?? null,
    cliente: principal.cliente,
    paciente: principal.paciente,
  })[0];
  const chave = chaveItemModulo(principal.id, item.id);
  const concluidas = mapaConcluidas?.[chave] ?? [];

  const linhaResumo = enriquecerLinhaTempoProducao(
    trabalhoParaLinha(principal, grupo, etapas, mapaConcluidas ?? {})
  );

  return trabalhoParaDetalheTempoProducao(
    principal,
    grupo,
    etapas,
    concluidas,
    linhaResumo
  );
}
