import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import { descricaoReceitaSemMeta } from "@/lib/receita-conta-bancaria";

export type LancamentoConciliacao = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
};

function descricaoExibirLancamento(lanc: LancamentoConciliacao) {
  if (lanc.tipo === "despesa") return desempacotarDespesa(lanc.descricao).texto;
  return descricaoReceitaSemMeta(lanc.descricao);
}

export type OpcaoProcedimento = {
  value: string;
  label: string;
};

function formatDataBr(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function moneyBr(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function referenciaDescricao(descricao: string) {
  const ref = descricao.match(/(?:ref\.?|referencia|fatura|os)\s*[:#]?\s*([^\s|]+)/i);
  if (ref?.[1]) return ref[1];
  const limpa = descricao.trim();
  if (limpa.length <= 40) return limpa || "—";
  return `${limpa.slice(0, 37)}...`;
}

export function montarOpcoesProcedimentoPorTipo(
  tipoLinha: "credito" | "debito",
  lancamentos: LancamentoConciliacao[]
): OpcaoProcedimento[] {
  const tipoLanc = tipoLinha === "credito" ? "receita" : "despesa";
  return lancamentos
    .filter((l) => l.tipo === tipoLanc && l.status !== "cancelado")
    .map((l) => {
      const tipoLabel = l.tipo === "receita" ? "RECEITA" : "DESPESA";
      const texto = descricaoExibirLancamento(l);
      const ref = referenciaDescricao(texto);
      const status =
        l.status === "pago" ? "" : ` (${l.status === "pendente" ? "a pagar/receber" : l.status})`;
      return {
        value: l.id,
        label: `${tipoLabel} ${formatDataBr(l.data)} ${texto.trim()} Ref.: ${ref} ${moneyBr(l.valor)}${status}`,
      };
    });
}

function mesmoDia(isoA: string, isoB: string) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function sugerirProcedimento(
  linha: { tipo: "credito" | "debito"; valor: number; data: string },
  lancamentos: LancamentoConciliacao[]
): string {
  const tipoEsperado = linha.tipo === "credito" ? "receita" : "despesa";
  const match = lancamentos.find(
    (l) =>
      l.status !== "cancelado" &&
      l.tipo === tipoEsperado &&
      Math.abs(l.valor - linha.valor) < 0.01 &&
      mesmoDia(l.data, linha.data)
  );
  return match?.id ?? "";
}
