import {
  trabalhoContaNoGraficoProducao,
  type TrabalhoProducaoResumo,
} from "@/lib/dashboard-producao";

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

export const OPCOES_DIAS_SEM_SERVICO = [
  { value: 15, label: "15 d.m." },
  { value: 30, label: "30 d.m." },
  { value: 60, label: "60 d.m." },
  { value: 90, label: "90 d.m." },
] as const;

export function calcularClientesSemServico(
  clientes: Array<{ id: string; nome: string; ativo: boolean }>,
  trabalhos: Array<TrabalhoProducaoResumo & { clienteId: string }>,
  diasMinimos: number,
  limite = 25
): ClienteSemServicoItem[] {
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);

  const ultimoPorCliente = new Map<string, Date>();
  for (const t of trabalhos) {
    if (!trabalhoContaNoGraficoProducao(t)) continue;
    const d = new Date(t.dataEntrada);
    const prev = ultimoPorCliente.get(t.clienteId);
    if (!prev || d > prev) ultimoPorCliente.set(t.clienteId, d);
  }

  const lista: ClienteSemServicoItem[] = [];
  for (const c of clientes) {
    if (!c.ativo) continue;
    const ultimo = ultimoPorCliente.get(c.id);
    let diasSemServico: number;
    if (!ultimo) {
      diasSemServico = diasMinimos + 1;
    } else {
      const ref = new Date(ultimo);
      ref.setHours(12, 0, 0, 0);
      diasSemServico = Math.floor(
        (hoje.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
    if (diasSemServico <= diasMinimos) continue;
    lista.push({
      id: c.id,
      nome: c.nome,
      ultimoServicoEm: ultimo ? ultimo.toISOString() : null,
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
