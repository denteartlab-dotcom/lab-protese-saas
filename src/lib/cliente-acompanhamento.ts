import { randomBytes } from "crypto";
import {
  parseComplementosInstrucoesGrupo,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import { flagsUrgenciaTrabalho, itensDaOsModulo } from "@/lib/modulo-producao-os";
import {
  indiceEtapaAtualDeConcluidas,
  situacaoEtapaServico,
} from "@/lib/modulo-producao-etapas";
import { clienteNomeComAbreviacao } from "@/lib/cliente-observacoes";
import { metaStatusOs } from "@/lib/status-os";
import {
  calcularLimitesUrgenciaCliente,
  trabalhoAtivoUrgencia,
  type EventoUrgenciaCliente,
  type LimitesUrgenciaCliente,
} from "@/lib/urgencia-cliente";

export function gerarTokenAcompanhamentoCliente() {
  return randomBytes(16).toString("hex");
}

export type EtapaAcompanhamentoPublico = EtapaOsLinha & {
  situacao: "concluida" | "atual" | "aguardando";
};

export type TrabalhoAcompanhamentoPublico = {
  id: string;
  numeroOs: number;
  segmentoFaturamento: string;
  pacienteNome: string;
  tipoProtese: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  dataEntrada: string;
  dataPrevista: string | null;
  dataEntrega: string | null;
  etapaAtual: string;
  etapas: EtapaAcompanhamentoPublico[];
  atualizadoEm: string;
  urgente: boolean;
  podeSolicitarUrgente: boolean;
};

export type ClienteAcompanhamentoPublico = {
  cliente: { nome: string; nomeExibicao: string; razaoSocial: string | null };
  labNome: string;
  atualizadoEm: string;
  limitesUrgencia: LimitesUrgenciaCliente;
  trabalhos: TrabalhoAcompanhamentoPublico[];
};

type TrabalhoDb = {
  id: string;
  numeroOs: number;
  segmentoFaturamento: string;
  grupoOsId: string | null;
  tipoProtese: string;
  status: string;
  dataEntrada: Date;
  dataPrevista: Date | null;
  dataEntrega: Date | null;
  instrucoes: string | null;
  updatedAt: Date;
  paciente: { nome: string };
};

function statusMeta(status: string) {
  const meta = metaStatusOs(status);
  return { label: meta.label, color: meta.color };
}

function etapasComSituacao(
  etapas: EtapaOsLinha[],
  concluidas: number[]
): EtapaAcompanhamentoPublico[] {
  const indiceAtual = indiceEtapaAtualDeConcluidas(concluidas, etapas.length);
  return etapas.map((etapa, index) => ({
    ...etapa,
    situacao: situacaoEtapaServico(index, indiceAtual),
  }));
}

export function montarAcompanhamentoPublico(
  cliente: {
    id: string;
    nome: string;
    razaoSocial: string | null;
    observacoes?: string | null;
  },
  trabalhos: TrabalhoDb[],
  labNome: string,
  mapaEtapas: Record<string, number[]> = {},
  eventosUrgencia: EventoUrgenciaCliente[] = []
): ClienteAcompanhamentoPublico {
  const limitesUrgencia = calcularLimitesUrgenciaCliente(
    eventosUrgencia,
    trabalhos.map((t) => ({
      id: t.id,
      clienteId: cliente.id,
      status: t.status,
      tipoProtese: t.tipoProtese,
      instrucoes: t.instrucoes,
      numeroOs: t.numeroOs,
    })),
    cliente.id
  );

  const grupos = new Map<string, TrabalhoDb[]>();

  for (const t of trabalhos) {
    const key = t.grupoOsId || `os-${t.numeroOs}`;
    const lista = grupos.get(key) || [];
    lista.push(t);
    grupos.set(key, lista);
  }

  const publicos: TrabalhoAcompanhamentoPublico[] = [];

  for (const lista of grupos.values()) {
    const principal =
      lista.find((t) => t.segmentoFaturamento === "servico") || lista[0];
    const textos = lista.map((t) => t.instrucoes || "");
    const { etapas } = parseComplementosInstrucoesGrupo(textos);
    const moduloOs = {
      id: principal.id,
      numeroOs: principal.numeroOs,
      tipoProtese: principal.tipoProtese,
      valor: 0,
      status: principal.status,
      instrucoes: textos.join("\n"),
      dataEntrada: principal.dataEntrada.toISOString(),
      dataPrevista: principal.dataPrevista?.toISOString() ?? null,
      cliente: { nome: cliente.nome },
      paciente: { nome: principal.paciente.nome },
    };
    const item = itensDaOsModulo(moduloOs)[0];
    const chaveEtapas = `${principal.id}:${item.id}`;
    const concluidas = mapaEtapas[chaveEtapas] ?? [];
    const etapasPublicas = etapasComSituacao(etapas, concluidas);
    const indiceAtual = indiceEtapaAtualDeConcluidas(concluidas, etapas.length);
    const etapaAtual = etapas[indiceAtual]?.nome?.trim() || "Em produção";
    const { label, color } = statusMeta(principal.status);
    const atualizadoEm = lista.reduce(
      (max, t) => (t.updatedAt > max ? t.updatedAt : max),
      lista[0].updatedAt
    );
    const instrucoesGrupo = textos.join("\n");
    const urgente = flagsUrgenciaTrabalho({
      tipoProtese: principal.tipoProtese,
      instrucoes: instrucoesGrupo,
    }).urgente;
    const ativo = trabalhoAtivoUrgencia(principal.status);
    const limiteDia = limitesUrgencia.hoje >= limitesUrgencia.maxPorDia;
    const limiteAtivo = limitesUrgencia.ativos >= limitesUrgencia.maxAtivos;
    const podeSolicitarUrgente =
      ativo && !urgente && !limiteDia && !limiteAtivo;

    publicos.push({
      id: principal.id,
      numeroOs: principal.numeroOs,
      segmentoFaturamento: principal.segmentoFaturamento,
      pacienteNome: principal.paciente.nome,
      tipoProtese: principal.tipoProtese,
      status: principal.status,
      statusLabel: label,
      statusColor: color,
      dataEntrada: principal.dataEntrada.toISOString(),
      dataPrevista: principal.dataPrevista?.toISOString() ?? null,
      dataEntrega: principal.dataEntrega?.toISOString() ?? null,
      etapaAtual,
      etapas: etapasPublicas,
      atualizadoEm: atualizadoEm.toISOString(),
      urgente,
      podeSolicitarUrgente,
    });
  }

  publicos.sort((a, b) => b.numeroOs - a.numeroOs);

  const atualizadoEm = publicos[0]?.atualizadoEm || new Date().toISOString();

  return {
    cliente: {
      nome: cliente.nome,
      nomeExibicao: clienteNomeComAbreviacao(cliente),
      razaoSocial: cliente.razaoSocial,
    },
    labNome,
    atualizadoEm,
    limitesUrgencia,
    trabalhos: publicos,
  };
}
