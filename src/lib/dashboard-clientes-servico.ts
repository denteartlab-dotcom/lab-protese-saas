import {
  segmentoEfetivoTrabalho,
  trabalhoEhFichaSemServico,
} from "@/lib/trabalho-os-segmento";

export type ClienteSemServicoItem = {
  id: string;
  nome: string;
  ultimoServicoEm: string | null;
  diasSemServico: number;
};

export type AniversarianteMesItem = {
  id: string;
  nome: string;
  dataNascimento: string;
  dia: number;
  celular?: string | null;
  telefone?: string | null;
};

export type TrabalhoUltimoServicoCliente = {
  clienteId: string;
  status: string;
  dataEntrada: string | Date;
  segmentoFaturamento?: string | null;
  instrucoes?: string | null;
  tipoProtese?: string | null;
};

export const OPCOES_DIAS_SEM_SERVICO = [
  { value: 15, label: "15 d.m." },
  { value: 30, label: "30 d.m." },
  { value: 60, label: "60 d.m." },
  { value: 90, label: "90 d.m." },
] as const;

/** Mesma base do Controle de Produção: serviço odontológico lançado (não produto/transporte/ficha vazia). */
export function trabalhoContaComoUltimoServicoCliente(
  trabalho: TrabalhoUltimoServicoCliente
): boolean {
  if (trabalho.status === "cancelado") return false;
  if (segmentoEfetivoTrabalho(trabalho) !== "servico") return false;
  if (trabalhoEhFichaSemServico(trabalho)) return false;
  return true;
}

function inicioDoDia(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

function diasEntreDatas(inicio: Date, fim: Date) {
  return Math.floor(
    (inicioDoDia(fim).getTime() - inicioDoDia(inicio).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function calcularClientesSemServico(
  clientes: Array<{ id: string; nome: string; ativo: boolean }>,
  trabalhos: TrabalhoUltimoServicoCliente[],
  diasMinimos: number,
  limite = 25
): ClienteSemServicoItem[] {
  const hoje = inicioDoDia(new Date());

  const ultimoPorCliente = new Map<string, Date>();
  for (const t of trabalhos) {
    if (!trabalhoContaComoUltimoServicoCliente(t)) continue;
    const d = new Date(t.dataEntrada);
    if (Number.isNaN(d.getTime())) continue;
    const prev = ultimoPorCliente.get(t.clienteId);
    if (!prev || d > prev) ultimoPorCliente.set(t.clienteId, d);
  }

  const lista: ClienteSemServicoItem[] = [];
  for (const c of clientes) {
    if (!c.ativo) continue;
    const ultimo = ultimoPorCliente.get(c.id);
    if (!ultimo) continue;

    const diasSemServico = diasEntreDatas(ultimo, hoje);
    if (diasSemServico <= diasMinimos) continue;

    lista.push({
      id: c.id,
      nome: c.nome,
      ultimoServicoEm: ultimo.toISOString(),
      diasSemServico,
    });
  }

  return lista
    .sort((a, b) => {
      const ta = a.ultimoServicoEm ? new Date(a.ultimoServicoEm).getTime() : 0;
      const tb = b.ultimoServicoEm ? new Date(b.ultimoServicoEm).getTime() : 0;
      return ta - tb;
    })
    .slice(0, limite);
}
