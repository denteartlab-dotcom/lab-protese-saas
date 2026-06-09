import type { ContaBancaria, MovimentacaoContaBancaria } from "@/lib/conta-bancaria";
import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";
import {
  carregarContasBancarias,
  carregarMovimentacoesConta,
  salvarContasBancarias,
  salvarMovimentacoesConta,
} from "@/lib/conta-bancaria";
import {
  carregarExtratoBancario,
  salvarExtratoBancario,
} from "@/lib/extrato-bancario";

export type DadosContasBancariasApi = {
  contas: ContaBancaria[];
  movimentacoes: MovimentacaoContaBancaria[];
  extrato: ExtratoMovimentacao[];
};

/** Evita perder movimentações locais quando o GET chega antes do PUT concluir. */
export function mesclarMovimentacoesConta(
  local: MovimentacaoContaBancaria[],
  servidor: MovimentacaoContaBancaria[]
): MovimentacaoContaBancaria[] {
  const mapa = new Map(servidor.map((m) => [m.id, m]));
  for (const mov of local) {
    if (!mapa.has(mov.id)) mapa.set(mov.id, mov);
  }
  return Array.from(mapa.values()).sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
}

export async function carregarContasBancariasApi(): Promise<DadosContasBancariasApi> {
  try {
    const res = await fetch("/api/contas-bancarias", { cache: "no-store" });
    if (!res.ok) throw new Error("falha");
    const json = (await res.json()) as DadosContasBancariasApi;
    if (Array.isArray(json.contas)) salvarContasBancarias(json.contas);
    if (Array.isArray(json.movimentacoes)) {
      salvarMovimentacoesConta(json.movimentacoes);
    }
    if (Array.isArray(json.extrato)) salvarExtratoBancario(json.extrato);
    return {
      contas: json.contas ?? carregarContasBancarias(),
      movimentacoes: json.movimentacoes ?? carregarMovimentacoesConta(),
      extrato: json.extrato ?? carregarExtratoBancario(),
    };
  } catch {
    return {
      contas: carregarContasBancarias(),
      movimentacoes: carregarMovimentacoesConta(),
      extrato: carregarExtratoBancario(),
    };
  }
}

export async function persistirContasBancariasApi(input: {
  contas?: ContaBancaria[];
  movimentacoes?: MovimentacaoContaBancaria[];
  extrato?: ExtratoMovimentacao[];
}): Promise<DadosContasBancariasApi | null> {
  const contas = input.contas ?? carregarContasBancarias();
  const movimentacoes = input.movimentacoes ?? carregarMovimentacoesConta();
  const extrato = input.extrato ?? carregarExtratoBancario();

  salvarContasBancarias(contas);
  salvarMovimentacoesConta(movimentacoes);
  salvarExtratoBancario(extrato);

  try {
    const res = await fetch("/api/contas-bancarias", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contas, movimentacoes, extrato }),
    });
    if (!res.ok) throw new Error("falha");
    const json = (await res.json()) as DadosContasBancariasApi;
    if (Array.isArray(json.contas)) salvarContasBancarias(json.contas);
    if (Array.isArray(json.movimentacoes)) {
      salvarMovimentacoesConta(json.movimentacoes);
    }
    if (Array.isArray(json.extrato)) salvarExtratoBancario(json.extrato);
    return json;
  } catch {
    return null;
  }
}
