import { randomBytes } from "crypto";
import {
  parseComplementosInstrucoesGrupo,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import { STATUS_TRABALHO } from "@/lib/utils";

export function gerarTokenAcompanhamentoCliente() {
  return randomBytes(16).toString("hex");
}

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
  etapas: EtapaOsLinha[];
  atualizadoEm: string;
};

export type ClienteAcompanhamentoPublico = {
  cliente: { nome: string; razaoSocial: string | null };
  labNome: string;
  atualizadoEm: string;
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
  const meta = STATUS_TRABALHO[status];
  return {
    label: meta?.label || status,
    color: meta?.color || "bg-slate-100 text-slate-600",
  };
}

export function montarAcompanhamentoPublico(
  cliente: { nome: string; razaoSocial: string | null },
  trabalhos: TrabalhoDb[],
  labNome: string
): ClienteAcompanhamentoPublico {
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
    const { label, color } = statusMeta(principal.status);
    const atualizadoEm = lista.reduce(
      (max, t) => (t.updatedAt > max ? t.updatedAt : max),
      lista[0].updatedAt
    );

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
      etapas,
      atualizadoEm: atualizadoEm.toISOString(),
    });
  }

  publicos.sort((a, b) => b.numeroOs - a.numeroOs);

  const atualizadoEm = publicos[0]?.atualizadoEm || new Date().toISOString();

  return {
    cliente: {
      nome: cliente.nome,
      razaoSocial: cliente.razaoSocial,
    },
    labNome,
    atualizadoEm,
    trabalhos: publicos,
  };
}
