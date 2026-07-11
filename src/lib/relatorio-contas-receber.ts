import { parseBrDate } from "@/lib/datas-br";
import { abrirPdfNoVisualizador } from "@/lib/pdf-viewer";
import type { ModeloRelatorioReceitas } from "@/lib/relatorio-receitas-modelos";
import {
  modeloEhExtrato,
  modeloEhExtrato3Paciente,
  modeloEhExtrato2Individual,
  modeloEhExtratoIndividual,
  modeloEhParcelasAReceber,
  modeloEhRecebimentos,
} from "@/lib/relatorio-receitas-modelos";
import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import { formatDate } from "@/lib/utils";
import {
  isFaturaContasReceber,
  isCreditoGerado,
  isCreditoUtilizado,
  numeroFaturaDeLancamento,
  numerosOsTexto,
  recebidoNaFatura,
  referenciaLancamento,
  saldoFatura,
  situacaoFaturaLabel,
  textoParcelaLancamento,
  deveExibirNoHistoricoRecebimentos,
  valorHistoricoRecebimentoCliente,
  type LancamentoContasReceber,
  type TrabalhoContasReceber,
} from "@/lib/contas-receber-financeiro";
import type { TrabalhoRelatorioFatura } from "@/lib/relatorio-faturas-modelo3-dados";
import { nomePacienteTrabalho } from "@/lib/relatorio-faturas-modelo3-dados";

export type { ModeloRelatorioReceitas } from "@/lib/relatorio-receitas-modelos";

export type FiltroRelatorioContasReceber = {
  ordenarPor: "data_lancamento" | "vencimento" | "cliente" | "valor" | "fatura";
  situacao: "todos" | "a_receber" | "recebidas" | "atraso";
  cliente: string;
  formaRecebimento: string;
  periodoCampo: "data_lancamento" | "vencimento";
  periodoAtivo: boolean;
  dataInicio: string;
  dataFinal: string;
  modelo: ModeloRelatorioReceitas;
  /** Parcelas (A Receber) Modelo 1 e 2 — Smart */
  parcelasSomenteAReceber?: boolean;
  parcelasAgruparPorCliente?: boolean;
  recebimentosAgruparPorCliente?: boolean;
};

export type LinhaRelatorioContasReceber = {
  lancamentoId: string;
  vencimento: string;
  numeroFatura: number;
  parcela: string;
  cliente: string;
  os: string;
  formaRecebimento: string;
  valor: number;
  recebido: number;
  saldo: number;
  situacao: string;
  referencia?: string;
  descricao?: string;
  paciente?: string;
  dataOrdenacao: Date;
  dataLancamento: Date;
  /** Recebimentos (completo) — Smart */
  dataRecebimento?: string;
  valorBase?: number;
  juros?: number;
  desconto?: number;
  categoria?: string;
  descricaoLinha?: string;
};

type LancamentoRelatorio = LancamentoContasReceber;

function dateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function pacienteDoLancamento(
  lancamento: LancamentoRelatorio,
  trabalhos: TrabalhoContasReceber[]
) {
  if (lancamento.trabalho?.id) {
    const t = trabalhos.find((item) => item.id === lancamento.trabalho?.id);
    if (t) {
      const nome = nomePacienteTrabalho(t);
      if (nome !== "—") return nome;
    }
  }
  const nums = numerosOsTexto(lancamento);
  if (nums === "—") return "—";
  const primeiro = trabalhos.find((t) => nums.startsWith(String(t.numeroOs)));
  return primeiro ? nomePacienteTrabalho(primeiro) : "—";
}

function linhaBase(
  l: LancamentoRelatorio,
  receitas: LancamentoRelatorio[],
  trabalhos: TrabalhoContasReceber[]
): LinhaRelatorioContasReceber {
  const venc = dateOnly(l.data);
  const criado = l.createdAt ? dateOnly(l.createdAt) : venc;
  return {
    lancamentoId: l.id,
    vencimento: formatDate(l.data),
    numeroFatura: numeroFaturaDeLancamento(l, receitas),
    parcela: textoParcelaLancamento(l),
    cliente: l.cliente!.nome!.trim(),
    os: numerosOsTexto(l),
    formaRecebimento: l.formaPagamento || "—",
    valor: l.valor,
    recebido: recebidoNaFatura(l, receitas),
    saldo: saldoFatura(l, receitas),
    situacao: situacaoFaturaLabel(l),
    referencia: referenciaLancamento(l, receitas),
    descricao: l.descricao,
    paciente: pacienteDoLancamento(l, trabalhos),
    dataOrdenacao: venc,
    dataLancamento: criado,
  };
}

export function linhasFaturasFromLancamentos(
  lancamentos: LancamentoRelatorio[],
  trabalhos: TrabalhoContasReceber[]
): LinhaRelatorioContasReceber[] {
  const receitas = lancamentos.filter((l) => l.tipo === "receita");
  return receitas
    .filter(
      (l) =>
        l.cliente?.id &&
        l.cliente.nome?.trim() &&
        isFaturaContasReceber(l, receitas, trabalhos)
    )
    .map((l) => linhaBase(l, receitas, trabalhos));
}

function descricaoLinhaRecebimento(
  l: LancamentoRelatorio,
  base: LinhaRelatorioContasReceber
) {
  const os = base.os;
  if (os !== "—") {
    const parc =
      base.parcela && base.parcela !== "1 / 1" ? ` — Parc. ${base.parcela}` : "";
    return `OS: ${os}${parc}`;
  }
  const pack = desempacotarDespesa(l.descricao);
  const texto = pack.texto.split("\n")[0]?.trim();
  return texto || base.referencia || "—";
}

export function linhasRecebimentosFromLancamentos(
  lancamentos: LancamentoRelatorio[],
  trabalhos: TrabalhoContasReceber[]
): LinhaRelatorioContasReceber[] {
  const receitas = lancamentos.filter((l) => l.tipo === "receita");
  return receitas
    .filter(
      (l) =>
        l.cliente?.id &&
        l.cliente.nome?.trim() &&
        l.status === "pago" &&
        !isCreditoGerado(l) &&
        !isCreditoUtilizado(l) &&
        deveExibirNoHistoricoRecebimentos(l, receitas)
    )
    .map((l) => {
      const base = linhaBase(l, receitas, trabalhos);
      const pack = desempacotarDespesa(l.descricao);
      const valorExibido = valorHistoricoRecebimentoCliente(l, receitas);
      const dataVenc = l.createdAt ? formatDate(l.createdAt) : base.vencimento;
      const dataReceb = formatDate(l.data);
      return {
        ...base,
        recebido: valorExibido,
        saldo: 0,
        situacao: "Recebido",
        dataRecebimento: dataReceb,
        vencimento: dataVenc,
        valor: valorExibido,
        valorBase: valorExibido,
        juros: 0,
        desconto: 0,
        categoria: pack.categoria && pack.categoria !== "—" ? pack.categoria : "Receitas de Serviços",
        descricaoLinha: descricaoLinhaRecebimento(l, base),
      };
    });
}

export function linhasExtratoFromLancamentos(
  lancamentos: LancamentoRelatorio[],
  trabalhos: TrabalhoContasReceber[]
): LinhaRelatorioContasReceber[] {
  const receitas = lancamentos.filter((l) => l.tipo === "receita");
  return receitas
    .filter((l) => l.status !== "cancelado")
    .map((l) => {
      const base = linhaBase(l, receitas, trabalhos);
      if (isCreditoGerado(l)) {
        return { ...base, situacao: "Crédito", saldo: 0, recebido: l.valor };
      }
      if (isCreditoUtilizado(l)) {
        return { ...base, situacao: "Crédito usado", saldo: 0 };
      }
      if (l.status === "pago" && l.descricao.toLowerCase().startsWith("cobrança os")) {
        const valorExibido = valorHistoricoRecebimentoCliente(l, receitas);
        return { ...base, situacao: "Recebido", saldo: 0, recebido: valorExibido, valor: valorExibido };
      }
      return base;
    });
}

export function linhasRelatorioFromLancamentos(
  lancamentos: LancamentoRelatorio[],
  trabalhos: TrabalhoContasReceber[],
  modelo: ModeloRelatorioReceitas
): LinhaRelatorioContasReceber[] {
  if (modeloEhRecebimentos(modelo)) {
    return linhasRecebimentosFromLancamentos(lancamentos, trabalhos);
  }

  if (modeloEhExtrato(modelo)) {
    return linhasExtratoFromLancamentos(lancamentos, trabalhos);
  }

  const faturas = linhasFaturasFromLancamentos(lancamentos, trabalhos);

  if (modeloEhParcelasAReceber(modelo)) {
    return faturas;
  }

  return faturas;
}

export function filtrarLinhasRelatorioContasReceber(
  linhas: LinhaRelatorioContasReceber[],
  filtro: FiltroRelatorioContasReceber
) {
  const inicio = filtro.dataInicio ? parseBrDate(filtro.dataInicio) : null;
  const fim = filtro.dataFinal ? parseBrDate(filtro.dataFinal) : null;
  if (inicio) inicio.setHours(0, 0, 0, 0);
  if (fim) fim.setHours(23, 59, 59, 999);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return linhas.filter((linha) => {
    const dataRef =
      filtro.periodoCampo === "data_lancamento"
        ? linha.dataLancamento
        : linha.dataOrdenacao;
    if (filtro.periodoAtivo) {
      if (inicio && dataRef < inicio) return false;
      if (fim && dataRef > fim) return false;
    }

    if (filtro.situacao === "a_receber" && linha.saldo <= 0) return false;
    if (filtro.situacao === "recebidas" && linha.saldo > 0) return false;
    if (filtro.situacao === "atraso") {
      if (linha.saldo <= 0 || linha.dataOrdenacao >= hoje) return false;
    }

    if (filtro.cliente !== "todos" && linha.cliente !== filtro.cliente) return false;
    if (
      filtro.formaRecebimento !== "todos" &&
      linha.formaRecebimento !== filtro.formaRecebimento
    ) {
      return false;
    }

    return true;
  });
}

export function ordenarLinhasRelatorioContasReceber(
  linhas: LinhaRelatorioContasReceber[],
  ordenarPor: FiltroRelatorioContasReceber["ordenarPor"],
  modelo: ModeloRelatorioReceitas
) {
  const copia = [...linhas];
  copia.sort((a, b) => {
    if (modelo === "extrato-3-agrupado-paciente") {
      const pac = a.paciente?.localeCompare(b.paciente || "", "pt-BR") ?? 0;
      if (pac !== 0) return pac;
    }
    if (ordenarPor === "cliente") return a.cliente.localeCompare(b.cliente, "pt-BR");
    if (ordenarPor === "valor") return b.valor - a.valor;
    if (ordenarPor === "fatura") return a.numeroFatura - b.numeroFatura;
    if (ordenarPor === "vencimento") {
      return a.dataOrdenacao.getTime() - b.dataOrdenacao.getTime();
    }
    return a.dataLancamento.getTime() - b.dataLancamento.getTime();
  });
  return copia;
}

export type OpcoesImpressaoRelatorioReceitas = {
  periodoCampo: FiltroRelatorioContasReceber["periodoCampo"];
  dataInicio: string;
  dataFinal: string;
  periodoAtivo: boolean;
  ordenarPor?: FiltroRelatorioContasReceber["ordenarPor"];
  /** Extrato individual — nome do cliente no título. */
  nomeClienteExtrato?: string;
  /** Extrato individual — filtro por id (mais confiável que o nome). */
  clienteIdExtrato?: string | null;
  lancamentos?: LancamentoRelatorio[];
  trabalhos?: TrabalhoRelatorioFatura[];
  parcelasSomenteAReceber?: boolean;
  parcelasAgruparPorCliente?: boolean;
  recebimentosAgruparPorCliente?: boolean;
};

export async function gerarRelatorioContasReceberBlob(
  linhas: LinhaRelatorioContasReceber[],
  tituloModelo: string,
  periodoLabel: string,
  modelo: ModeloRelatorioReceitas,
  opcoes?: OpcoesImpressaoRelatorioReceitas
) {
  if (modeloEhExtratoIndividual(modelo) || modeloEhExtrato2Individual(modelo)) {
    const nomeCliente =
      opcoes?.nomeClienteExtrato?.trim() ||
      linhas[0]?.cliente?.trim() ||
      "Cliente";
    const opcoesPdf = {
      periodoAtivo: opcoes?.periodoAtivo,
      dataInicio: opcoes?.dataInicio,
      dataFinal: opcoes?.dataFinal,
      periodoCampo: opcoes?.periodoCampo,
      clienteId: opcoes?.clienteIdExtrato,
    };
    if (modeloEhExtrato2Individual(modelo)) {
      const { gerarRelatorioExtrato2IndividualSmartPdf } = await import(
        "@/lib/pdf-relatorio-extrato-2-individual-smart"
      );
      return gerarRelatorioExtrato2IndividualSmartPdf(
        opcoes?.lancamentos ?? [],
        opcoes?.trabalhos ?? [],
        nomeCliente,
        opcoesPdf
      );
    }
    const { gerarRelatorioExtratoIndividualSmartPdf } = await import(
      "@/lib/pdf-relatorio-extrato-individual-smart"
    );
    return gerarRelatorioExtratoIndividualSmartPdf(
      opcoes?.lancamentos ?? [],
      opcoes?.trabalhos ?? [],
      nomeCliente,
      opcoesPdf
    );
  }

  if (modeloEhExtrato3Paciente(modelo)) {
    const { gerarRelatorioExtrato3PacienteSmartPdf } = await import(
      "@/lib/pdf-relatorio-extrato-3-paciente-smart"
    );
    const nomeCliente =
      opcoes?.nomeClienteExtrato?.trim() ||
      linhas[0]?.cliente?.trim() ||
      "Cliente";
    return gerarRelatorioExtrato3PacienteSmartPdf(
      opcoes?.lancamentos ?? [],
      opcoes?.trabalhos ?? [],
      nomeCliente,
      {
        periodoAtivo: opcoes?.periodoAtivo,
        dataInicio: opcoes?.dataInicio,
        dataFinal: opcoes?.dataFinal,
        periodoCampo: opcoes?.periodoCampo,
        clienteId: opcoes?.clienteIdExtrato,
      }
    );
  }

  const { gerarRelatorioContasReceberPdf } = await import("@/lib/relatorios-impressao-pdf");
  return gerarRelatorioContasReceberPdf(
    linhas,
    tituloModelo,
    periodoLabel,
    modelo,
    opcoes
  );
}

export async function imprimirRelatorioContasReceber(
  linhas: LinhaRelatorioContasReceber[],
  tituloModelo: string,
  periodoLabel: string,
  modelo: ModeloRelatorioReceitas,
  opcoes?: OpcoesImpressaoRelatorioReceitas,
  janelaReservada?: Window | null
) {
  const janela = janelaReservada ?? null;
  try {
    const blob = await gerarRelatorioContasReceberBlob(
      linhas,
      tituloModelo,
      periodoLabel,
      modelo,
      opcoes
    );
    abrirPdfNoVisualizador(blob, "relatorio-receitas.pdf", undefined, janela);
  } catch (err) {
    janela?.close();
    throw err;
  }
}
