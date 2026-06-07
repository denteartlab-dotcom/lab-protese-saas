import {
  classificarEntidadeDespesa,
  desempacotarDespesa,
  type EntidadeDespesa,
} from "@/lib/lancamento-despesa";
import { parseBrDate } from "@/lib/datas-br";
import { abrirPdfNoVisualizador } from "@/lib/pdf-viewer";
import { gerarRelatorioDespesasModelo1Pdf } from "@/lib/pdf-relatorio-despesas-modelo1";
import { formatDate } from "@/lib/utils";

export type FiltroRelatorioDespesas = {
  ordenarPor: "data_lancamento" | "nome" | "valor" | "vencimento";
  situacao: "todos" | "a_pagar" | "pagas" | "atraso";
  categoria: string;
  nome: string;
  periodoCampo: "data_lancamento" | "vencimento";
  dataInicio: string;
  dataFinal: string;
};

export type LinhaRelatorioDespesa = {
  id: string;
  vencimento: string;
  parcela: string;
  nome: string;
  referencia: string;
  categoria: string;
  entidade: EntidadeDespesa;
  formaPagamento: string;
  valor: number;
  conta: string;
  status: string;
  dataOrdenacao: Date;
};

const ENTIDADES_RELATORIO: EntidadeDespesa[] = [
  "fornecedores",
  "colaboradores",
  "prestadores",
  "entregadores",
  "clientes",
];

export function entidadeRelatorioValida(value: string): value is EntidadeDespesa {
  return ENTIDADES_RELATORIO.includes(value as EntidadeDespesa);
}

type LancamentoRelatorio = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id?: string; nome: string } | null;
  trabalho?: { numeroOs: number } | null;
};

function dateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function linhasRelatorioFromLancamentos(
  lancamentos: LancamentoRelatorio[]
): LinhaRelatorioDespesa[] {
  return lancamentos
    .filter((l) => l.tipo === "despesa")
    .map((l) => {
      const pack = desempacotarDespesa(l.descricao);
      const ref =
        l.trabalho?.numeroOs != null ? `OS ${l.trabalho.numeroOs}` : pack.referencia;
      const dataLanc = dateOnly(l.data);
      const entidade =
        pack.meta.entidade ||
        classificarEntidadeDespesa(pack.nome, Boolean(l.cliente?.id), {
          fornecedores: [],
          colaboradores: [],
          prestadores: [],
          entregadores: [],
        });
      return {
        id: l.id,
        vencimento: formatDate(l.data),
        parcela: pack.parcela,
        nome: l.cliente?.nome || pack.nome,
        referencia: ref,
        categoria: pack.categoria,
        entidade,
        formaPagamento: l.formaPagamento || "—",
        valor: l.valor,
        conta: pack.conta,
        status: l.status,
        dataOrdenacao: dataLanc,
      };
    });
}

export function filtrarLinhasRelatorio(
  linhas: LinhaRelatorioDespesa[],
  filtro: FiltroRelatorioDespesas
) {
  const inicio = filtro.dataInicio ? parseBrDate(filtro.dataInicio) : null;
  const fim = filtro.dataFinal ? parseBrDate(filtro.dataFinal) : null;
  if (inicio) inicio.setHours(0, 0, 0, 0);
  if (fim) fim.setHours(23, 59, 59, 999);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return linhas.filter((linha) => {
    const dataRef = linha.dataOrdenacao;
    if (inicio && dataRef < inicio) return false;
    if (fim && dataRef > fim) return false;

    if (filtro.situacao === "a_pagar" && linha.status !== "pendente") return false;
    if (filtro.situacao === "pagas" && linha.status !== "pago") return false;
    if (filtro.situacao === "atraso") {
      if (linha.status !== "pendente" || dataRef >= hoje) return false;
    }

    if (filtro.categoria !== "todos") {
      if (entidadeRelatorioValida(filtro.categoria)) {
        if (linha.entidade !== filtro.categoria) return false;
      } else if (linha.categoria !== filtro.categoria) {
        return false;
      }
    }
    if (filtro.nome !== "todos" && linha.nome !== filtro.nome) return false;

    return true;
  });
}

export function ordenarLinhasRelatorio(
  linhas: LinhaRelatorioDespesa[],
  ordenarPor: FiltroRelatorioDespesas["ordenarPor"]
) {
  const copia = [...linhas];
  copia.sort((a, b) => {
    if (ordenarPor === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
    if (ordenarPor === "valor") return b.valor - a.valor;
    return a.dataOrdenacao.getTime() - b.dataOrdenacao.getTime();
  });
  return copia;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type OpcoesImpressaoRelatorioDespesas = {
  modelo: string;
  periodoCampo: FiltroRelatorioDespesas["periodoCampo"];
  dataInicio: string;
  dataFinal: string;
  lancamentos?: LancamentoRelatorio[];
};

export async function gerarRelatorioDespesasBlob(
  linhas: LinhaRelatorioDespesa[],
  tituloModelo: string,
  periodoLabel: string,
  opcoes?: OpcoesImpressaoRelatorioDespesas
) {
  if (opcoes?.modelo === "despesas-modelo-1") {
    return gerarRelatorioDespesasModelo1Pdf(linhas, {
      periodoCampo: opcoes.periodoCampo,
      dataInicio: opcoes.dataInicio,
      dataFinal: opcoes.dataFinal,
    });
  }

  if (opcoes?.modelo === "despesas-modelo-2" && opcoes.lancamentos) {
    const { gerarRelatorioDespesasModelo2Pdf } = await import(
      "@/lib/pdf-relatorio-despesas-modelo2"
    );
    return gerarRelatorioDespesasModelo2Pdf({
      periodoCampo: opcoes.periodoCampo,
      dataInicio: opcoes.dataInicio,
      dataFinal: opcoes.dataFinal,
      lancamentos: opcoes.lancamentos,
      idsIncluidos: new Set(linhas.map((l) => l.id)),
    });
  }

  const { gerarRelatorioDespesasPdf } = await import("@/lib/relatorios-impressao-pdf");
  return gerarRelatorioDespesasPdf(linhas, tituloModelo, periodoLabel, opcoes);
}

export async function imprimirRelatorioDespesas(
  linhas: LinhaRelatorioDespesa[],
  tituloModelo: string,
  periodoLabel: string,
  janelaReservada?: Window | null,
  opcoes?: OpcoesImpressaoRelatorioDespesas
) {
  const janela = janelaReservada ?? null;
  try {
    const blob = await gerarRelatorioDespesasBlob(
      linhas,
      tituloModelo,
      periodoLabel,
      opcoes
    );
    abrirPdfNoVisualizador(blob, "relatorio-despesas.pdf", undefined, janela);
  } catch (err) {
    janela?.close();
    throw err;
  }
}

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
