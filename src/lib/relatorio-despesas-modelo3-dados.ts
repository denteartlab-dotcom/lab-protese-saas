import { chaveGrupoDespesa, desempacotarDespesa } from "@/lib/lancamento-despesa";
import {
  dataBrDeIso,
  numeroDespesaDoGrupo,
  parcelasDoGrupo,
  type ParcelaDespesaModelo2,
} from "@/lib/relatorio-despesas-modelo2-dados";

type LancamentoDespesaGrupo = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
};

export type ItemDespesaModelo3 = {
  descricao: string;
  qtd: string;
  un: string;
  valorUn: number;
  subtotal: number;
};

export type DespesaModelo3Bloco = {
  numero: string;
  fornecedor: string;
  dataEmissao: string;
  itens: ItemDespesaModelo3[];
  parcelas: ParcelaDespesaModelo2[];
  subtotalFatura: number;
  juros: number;
  subtotalPago: number;
  saldoDevedor: number;
};

function parseItensDespesa(texto: string, valorTotal: number): ItemDespesaModelo3[] {
  const partes = texto.split("|").map((p) => p.trim()).filter(Boolean);
  let corpo = texto;
  if (partes.length > 1) {
    corpo = partes.slice(0, -1).join(" | ");
  }

  const segmentos = corpo.split(";").map((s) => s.trim()).filter(Boolean);
  if (!segmentos.length) {
    return [
      {
        descricao: texto.trim() || "—",
        qtd: "1",
        un: "UN",
        valorUn: valorTotal,
        subtotal: valorTotal,
      },
    ];
  }

  const itens = segmentos.map((seg) => {
    const dashIdx = seg.indexOf(" - ");
    const descricao =
      dashIdx >= 0
        ? `${seg.slice(0, dashIdx).trim()} - ${seg.slice(dashIdx + 3).trim()}`
        : seg;
    const valorUn = segmentos.length === 1 ? valorTotal : 0;
    const qtd = 1;
    return {
      descricao,
      qtd: String(qtd),
      un: "UN",
      valorUn,
      subtotal: qtd * valorUn,
    };
  });

  const soma = itens.reduce((s, item) => s + item.subtotal, 0);
  if (soma <= 0 && valorTotal > 0 && itens.length === 1) {
    itens[0].valorUn = valorTotal;
    itens[0].subtotal = valorTotal;
  }

  return itens;
}

function itensDoPrincipal(
  principal: LancamentoDespesaGrupo,
  totalFatura: number,
  fornecedor: string
) {
  const pack = desempacotarDespesa(principal.descricao);
  const texto = pack.texto.replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/, "").trim();
  const itens = parseItensDespesa(texto, totalFatura);
  const soma = itens.reduce((s, item) => s + item.subtotal, 0);
  if (soma <= 0 && totalFatura > 0) {
    return [
      {
        descricao: texto || fornecedor,
        qtd: "1",
        un: "UN",
        valorUn: totalFatura,
        subtotal: totalFatura,
      },
    ];
  }
  return itens;
}

export function montarBlocosDespesasModelo3(
  lancamentos: LancamentoDespesaGrupo[],
  idsIncluidos: Set<string>
): DespesaModelo3Bloco[] {
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");
  const grupos = new Map<string, LancamentoDespesaGrupo[]>();

  for (const lancamento of despesas) {
    const chave = chaveGrupoDespesa(lancamento.descricao);
    const lista = grupos.get(chave) ?? [];
    lista.push(lancamento);
    grupos.set(chave, lista);
  }

  const blocos: DespesaModelo3Bloco[] = [];

  Array.from(grupos.entries()).forEach(([, grupo], indice) => {
    const incluiGrupo = grupo.some((item) => idsIncluidos.has(item.id));
    if (!incluiGrupo) return;

    const ordenado = [...grupo].sort((a, b) => a.data.localeCompare(b.data));
    const principal = ordenado[0];
    const pack = desempacotarDespesa(principal.descricao);
    const fornecedor =
      pack.nome ||
      pack.texto.replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/, "").trim().slice(0, 60) ||
      "—";
    const parcelas = parcelasDoGrupo(ordenado).map((p) => ({
      ...p,
      parcela: p.parcela.replace(/\s+/g, ""),
    }));
    const totalFatura = parcelas.reduce((s, p) => s + p.valor, 0);
    const totalPago = parcelas.reduce((s, p) => s + p.pago, 0);
    const itens = itensDoPrincipal(principal, totalFatura, fornecedor);
    const subtotalFatura = itens.reduce((s, item) => s + item.subtotal, 0) || totalFatura;
    const juros = 0;

    blocos.push({
      numero: numeroDespesaDoGrupo(ordenado, indice),
      fornecedor,
      dataEmissao: dataBrDeIso(principal.data),
      itens,
      parcelas,
      subtotalFatura,
      juros,
      subtotalPago: totalPago,
      saldoDevedor: Math.max(0, subtotalFatura + juros - totalPago),
    });
  });

  return blocos.sort((a, b) => {
    const da = a.dataEmissao.split("/").reverse().join("");
    const db = b.dataEmissao.split("/").reverse().join("");
    if (da !== db) return da.localeCompare(db);
    return a.fornecedor.localeCompare(b.fornecedor, "pt-BR");
  });
}
