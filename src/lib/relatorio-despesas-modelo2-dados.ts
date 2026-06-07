import { somarDiasIso } from "@/lib/datas-br";
import { chaveGrupoDespesa, desempacotarDespesa } from "@/lib/lancamento-despesa";
import { formatDate } from "@/lib/utils";

const INTERVALO_DIAS_PARCELA = 30;

type LancamentoDespesaGrupo = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
};

export type ParcelaDespesaModelo2 = {
  parcela: string;
  vencimento: string;
  formaPagamento: string;
  valor: number;
  juros: number;
  pago: number;
  dataPagamento: string;
  quitada: boolean;
};

export type DespesaModelo2Bloco = {
  numero: string;
  fornecedor: string;
  dataEmissao: string;
  parcelas: ParcelaDespesaModelo2[];
  totalFatura: number;
  totalPago: number;
  saldoDevedor: number;
};

function parcelaNumeros(texto: string, parcelaMeta: string) {
  const match = texto.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (match) {
    return { numero: Number(match[1]) || 1, total: Number(match[2]) || 1 };
  }
  const total = Number.parseInt(parcelaMeta, 10);
  if (Number.isFinite(total) && total > 1) {
    return { numero: 1, total };
  }
  return { numero: 1, total: 1 };
}

function formatarParcelaLabel(numero: number, total: number) {
  return `${numero} / ${total}`;
}

export function dataBrDeIso(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return formatDate(iso);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function numeroDespesaDoGrupo(
  grupo: LancamentoDespesaGrupo[],
  indice: number
) {
  const principal = grupo[0];
  const pack = desempacotarDespesa(principal.descricao);
  const ref = pack.referencia !== "—" ? pack.referencia : "";
  const digitos = ref.replace(/\D/g, "");
  if (digitos.length >= 3) return digitos;
  const idCurto = principal.id.replace(/\D/g, "").slice(-6);
  if (idCurto.length >= 3) return idCurto;
  return String(indice + 1).padStart(3, "0");
}

export function parcelasDoGrupo(grupo: LancamentoDespesaGrupo[]): ParcelaDespesaModelo2[] {
  if (grupo.length > 1) {
    return grupo
      .map((item) => {
        const pack = desempacotarDespesa(item.descricao);
        const { numero, total } = parcelaNumeros(pack.texto, pack.parcela);
        const quitada = item.status === "pago";
        return {
          parcela: formatarParcelaLabel(numero, total),
          vencimento: dataBrDeIso(item.data),
          formaPagamento: item.formaPagamento?.trim() || "",
          valor: item.valor,
          juros: 0,
          pago: quitada ? item.valor : 0,
          dataPagamento: quitada ? dataBrDeIso(item.data) : "",
          quitada,
        };
      })
      .sort((a, b) => {
        const na = Number(a.parcela.split("/")[0]?.trim()) || 0;
        const nb = Number(b.parcela.split("/")[0]?.trim()) || 0;
        return na - nb;
      });
  }

  const lancamento = grupo[0];
  const pack = desempacotarDespesa(lancamento.descricao);
  const { numero: numAtual, total } = parcelaNumeros(pack.texto, pack.parcela);

  if (total > 1) {
    const parcelas: ParcelaDespesaModelo2[] = [];
    for (let n = 1; n <= total; n++) {
      const isAtual = n === numAtual;
      const quitada = isAtual && lancamento.status === "pago";
      const vencimentoIso = somarDiasIso(
        lancamento.data,
        (n - 1) * INTERVALO_DIAS_PARCELA
      );
      parcelas.push({
        parcela: formatarParcelaLabel(n, total),
        vencimento: dataBrDeIso(vencimentoIso),
        formaPagamento: isAtual ? lancamento.formaPagamento?.trim() || "" : "",
        valor: lancamento.valor,
        juros: 0,
        pago: quitada ? lancamento.valor : 0,
        dataPagamento: quitada ? dataBrDeIso(lancamento.data) : "",
        quitada,
      });
    }
    return parcelas;
  }

  const quitada = lancamento.status === "pago";
  return [
    {
      parcela: formatarParcelaLabel(1, 1),
      vencimento: dataBrDeIso(lancamento.data),
      formaPagamento: lancamento.formaPagamento?.trim() || "",
      valor: lancamento.valor,
      juros: 0,
      pago: quitada ? lancamento.valor : 0,
      dataPagamento: quitada ? dataBrDeIso(lancamento.data) : "",
      quitada,
    },
  ];
}

export function montarBlocosDespesasModelo2(
  lancamentos: LancamentoDespesaGrupo[],
  idsIncluidos: Set<string>
): DespesaModelo2Bloco[] {
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");
  const grupos = new Map<string, LancamentoDespesaGrupo[]>();

  for (const lancamento of despesas) {
    const chave = chaveGrupoDespesa(lancamento.descricao);
    const lista = grupos.get(chave) ?? [];
    lista.push(lancamento);
    grupos.set(chave, lista);
  }

  const blocos: DespesaModelo2Bloco[] = [];

  Array.from(grupos.entries()).forEach(([chave, grupo], indice) => {
    const incluiGrupo = grupo.some((item) => idsIncluidos.has(item.id));
    if (!incluiGrupo) return;

    const ordenado = [...grupo].sort((a, b) => a.data.localeCompare(b.data));
    const principal = ordenado[0];
    const pack = desempacotarDespesa(principal.descricao);
    const parcelas = parcelasDoGrupo(ordenado);
    const totalFatura = parcelas.reduce((s, p) => s + p.valor, 0);
    const totalPago = parcelas.reduce((s, p) => s + p.pago, 0);
    const saldoDevedor = parcelas.reduce(
      (s, p) => s + (p.quitada ? 0 : p.valor),
      0
    );

    blocos.push({
      numero: numeroDespesaDoGrupo(ordenado, indice),
      fornecedor:
        pack.nome ||
        pack.texto.replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/, "").trim().slice(0, 60) ||
        "—",
      dataEmissao: dataBrDeIso(principal.data),
      parcelas,
      totalFatura,
      totalPago,
      saldoDevedor,
    });
  });

  return blocos.sort((a, b) => {
    const da = a.dataEmissao.split("/").reverse().join("");
    const db = b.dataEmissao.split("/").reverse().join("");
    if (da !== db) return da.localeCompare(db);
    return a.fornecedor.localeCompare(b.fornecedor, "pt-BR");
  });
}
