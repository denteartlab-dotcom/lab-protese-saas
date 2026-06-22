import { parseBrDate } from "@/lib/datas-br";
import { desempacotarDespesa } from "@/lib/lancamento-despesa";

export type GrupoBoletoTabela = "vencidos" | "proximos" | "pagos";

export type FiltroStatusBoleto =
  | "todos"
  | "em_analise"
  | "aguardando"
  | "vencidos"
  | "pagos";

export type LancamentoBoletoResumo = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  createdAt?: string;
  updatedAt?: string;
  cliente?: { id: string; nome: string } | null;
  trabalho?: { id: string; numeroOs: number } | null;
};

export type LinhaBoleto = {
  lancamento: LancamentoBoletoResumo;
  pack: ReturnType<typeof desempacotarDespesa>;
  fornecedor: string;
  categoria: string;
  ref: string;
  grupo: GrupoBoletoTabela;
  diasAteVencimento: number;
  emAnalise: boolean;
  aguardandoPagamento: boolean;
};

export function dateOnlyBoleto(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function hojeBoleto() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

export function diasEntreBoleto(de: Date, ate: Date) {
  return Math.round((ate.getTime() - de.getTime()) / (1000 * 60 * 60 * 24));
}

export function dataEmissaoBoleto(lancamento: LancamentoBoletoResumo) {
  if (lancamento.createdAt) {
    const d = dateOnlyBoleto(lancamento.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return dateOnlyBoleto(lancamento.data);
}

export function classificarGrupoBoleto(
  lancamento: Pick<LancamentoBoletoResumo, "status" | "data">,
  hoje = hojeBoleto()
): GrupoBoletoTabela {
  if (lancamento.status === "pago") return "pagos";
  if (lancamento.status === "pendente") {
    const venc = dateOnlyBoleto(lancamento.data);
    if (venc < hoje) return "vencidos";
    return "proximos";
  }
  return "proximos";
}

export function montarLinhaBoleto(
  lancamento: LancamentoBoletoResumo,
  hoje = hojeBoleto()
): LinhaBoleto {
  const pack = desempacotarDespesa(lancamento.descricao);
  const venc = dateOnlyBoleto(lancamento.data);
  const diasAteVencimento = diasEntreBoleto(hoje, venc);
  const grupo = classificarGrupoBoleto(lancamento, hoje);
  const pendente = lancamento.status === "pendente";
  const emAnalise = pendente && diasAteVencimento > 14;
  const aguardandoPagamento = pendente && diasAteVencimento <= 14 && venc >= hoje;
  const fornecedor =
    (lancamento.cliente?.nome || pack.nome || pack.texto || "—").trim() || "—";
  const ref =
    lancamento.trabalho?.numeroOs != null
      ? `OS ${lancamento.trabalho.numeroOs}`
      : pack.referencia || "—";

  return {
    lancamento,
    pack,
    fornecedor,
    categoria: pack.categoria || "—",
    ref,
    grupo,
    diasAteVencimento,
    emAnalise,
    aguardandoPagamento,
  };
}

export function linhaPassaFiltroStatus(
  linha: LinhaBoleto,
  filtro: FiltroStatusBoleto
) {
  if (filtro === "todos") return true;
  if (filtro === "pagos") return linha.grupo === "pagos";
  if (filtro === "vencidos") return linha.grupo === "vencidos";
  if (filtro === "em_analise") return linha.emAnalise;
  if (filtro === "aguardando") return linha.aguardandoPagamento || linha.grupo === "vencidos";
  return true;
}

export type ResumoBoletos = {
  emAnaliseQtd: number;
  emAnaliseValor: number;
  aguardandoQtd: number;
  aguardandoValor: number;
  pagosMesQtd: number;
  pagosMesValor: number;
  vencidosQtd: number;
  vencidosValor: number;
};

export function calcularResumoBoletos(
  linhas: LinhaBoleto[],
  hoje = hojeBoleto()
): ResumoBoletos {
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  let emAnaliseQtd = 0;
  let emAnaliseValor = 0;
  let aguardandoQtd = 0;
  let aguardandoValor = 0;
  let pagosMesQtd = 0;
  let pagosMesValor = 0;
  let vencidosQtd = 0;
  let vencidosValor = 0;

  for (const linha of linhas) {
    const { lancamento, emAnalise, aguardandoPagamento, grupo } = linha;
    if (emAnalise) {
      emAnaliseQtd += 1;
      emAnaliseValor += lancamento.valor;
    }
    if (aguardandoPagamento) {
      aguardandoQtd += 1;
      aguardandoValor += lancamento.valor;
    }
    if (grupo === "vencidos") {
      vencidosQtd += 1;
      vencidosValor += lancamento.valor;
    }
    if (lancamento.status === "pago") {
      const ref = lancamento.updatedAt
        ? dateOnlyBoleto(lancamento.updatedAt)
        : dateOnlyBoleto(lancamento.data);
      if (ref.getMonth() === mesAtual && ref.getFullYear() === anoAtual) {
        pagosMesQtd += 1;
        pagosMesValor += lancamento.valor;
      }
    }
  }

  return {
    emAnaliseQtd,
    emAnaliseValor,
    aguardandoQtd,
    aguardandoValor,
    pagosMesQtd,
    pagosMesValor,
    vencidosQtd,
    vencidosValor,
  };
}

export type PontoGraficoBoletos = {
  mes: string;
  pagos: number;
  pendentes: number;
};

export function graficoBoletosPorMes(
  linhas: LinhaBoleto[],
  meses = 6
): PontoGraficoBoletos[] {
  const hoje = hojeBoleto();
  const rotulos = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const pontos: PontoGraficoBoletos[] = [];

  for (let i = meses - 1; i >= 0; i--) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mesIdx = ref.getMonth();
    const ano = ref.getFullYear();
    let pagos = 0;
    let pendentes = 0;

    for (const linha of linhas) {
      const venc = dateOnlyBoleto(linha.lancamento.data);
      if (venc.getMonth() !== mesIdx || venc.getFullYear() !== ano) continue;
      if (linha.lancamento.status === "pago") pagos += linha.lancamento.valor;
      else if (linha.lancamento.status === "pendente") {
        pendentes += linha.lancamento.valor;
      }
    }

    pontos.push({ mes: rotulos[mesIdx], pagos, pendentes });
  }

  return pontos;
}

export type AlertaBoleto = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: "vencido" | "proximo" | "info";
  valor: number;
  lancamentoId: string;
};

export function alertasBoletos(linhas: LinhaBoleto[], limite = 8): AlertaBoleto[] {
  const alertas: AlertaBoleto[] = [];

  for (const linha of linhas) {
    if (linha.lancamento.status !== "pendente") continue;
    if (linha.grupo === "vencidos") {
      alertas.push({
        id: `v-${linha.lancamento.id}`,
        titulo: "Boleto vencido",
        descricao: `${linha.fornecedor} · venceu há ${Math.abs(linha.diasAteVencimento)} dia(s)`,
        tipo: "vencido",
        valor: linha.lancamento.valor,
        lancamentoId: linha.lancamento.id,
      });
    } else if (linha.diasAteVencimento <= 7) {
      alertas.push({
        id: `p-${linha.lancamento.id}`,
        titulo: "Vence em breve",
        descricao: `${linha.fornecedor} · ${linha.diasAteVencimento === 0 ? "vence hoje" : `em ${linha.diasAteVencimento} dia(s)`}`,
        tipo: "proximo",
        valor: linha.lancamento.valor,
        lancamentoId: linha.lancamento.id,
      });
    }
  }

  return alertas
    .sort((a, b) => {
      const peso = { vencido: 0, proximo: 1, info: 2 };
      return peso[a.tipo] - peso[b.tipo];
    })
    .slice(0, limite);
}

export function formatarMoedaBoleto(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function labelStatusBoleto(linha: LinhaBoleto) {
  if (linha.lancamento.status === "pago") return "Pago";
  if (linha.grupo === "vencidos") return "Vencido";
  if (linha.emAnalise) return "Em análise";
  return "Aguardando pagamento";
}

export function filtrarLinhasBoletos(
  lancamentos: LancamentoBoletoResumo[],
  opts: {
    busca?: string;
    dataInicio?: string;
    dataFim?: string;
    status?: FiltroStatusBoleto;
  }
): LinhaBoleto[] {
  const hoje = hojeBoleto();
  const inicio = opts.dataInicio ? parseBrDate(opts.dataInicio) : null;
  const fim = opts.dataFim ? parseBrDate(opts.dataFim) : null;
  if (inicio) inicio.setHours(0, 0, 0, 0);
  if (fim) fim.setHours(23, 59, 59, 999);
  const termo = (opts.busca || "").trim().toLowerCase();
  const status = opts.status || "todos";

  return lancamentos
    .filter((l) => l.tipo === "despesa" && l.status !== "cancelado")
    .map((l) => montarLinhaBoleto(l, hoje))
    .filter((linha) => {
      const venc = dateOnlyBoleto(linha.lancamento.data);
      if (inicio && venc < inicio) return false;
      if (fim && venc > fim) return false;
      if (!linhaPassaFiltroStatus(linha, status)) return false;
      if (!termo) return true;
      const blob = [
        linha.fornecedor,
        linha.categoria,
        linha.ref,
        linha.lancamento.formaPagamento,
        linha.pack.texto,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(termo);
    });
}
