import {
  segmentoEfetivoTrabalho,
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
  whatsapp?: string | null;
  aniversarioHoje?: boolean;
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
  { value: 15, label: "15 dias" },
  { value: 30, label: "30 dias" },
  { value: 60, label: "60 dias" },
  { value: 90, label: "90 dias" },
] as const;

export const LIMITE_CLIENTES_SERVICO_PAINEL = 3;

/** Menor tempo sem serviço = último serviço mais recente (aparece primeiro). */
export function ordenarClientesSemServicoPorMenosTempo(lista: ClienteSemServicoItem[]) {
  return [...lista].sort((a, b) => {
    const ta = a.ultimoServicoEm ? new Date(a.ultimoServicoEm).getTime() : 0;
    const tb = b.ultimoServicoEm ? new Date(b.ultimoServicoEm).getTime() : 0;
    return tb - ta;
  });
}

/** Qualquer OS de serviço gerada (não cancelada) atualiza a data do último serviço do cliente. */
export function trabalhoContaComoUltimoServicoCliente(
  trabalho: TrabalhoUltimoServicoCliente
): boolean {
  if (trabalho.status === "cancelado") return false;
  return segmentoEfetivoTrabalho(trabalho) === "servico";
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
  limite?: number
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
    if (diasSemServico < diasMinimos) continue;

    lista.push({
      id: c.id,
      nome: c.nome,
      ultimoServicoEm: ultimo.toISOString(),
      diasSemServico,
    });
  }

  const ordenada = ordenarClientesSemServicoPorMenosTempo(lista);

  if (limite == null || limite <= 0) return ordenada;
  return ordenada.slice(0, limite);
}
