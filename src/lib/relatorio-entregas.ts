import {
  filtrarEntregas,
  formatarDataEntrega,
  formatarDataHoraEntrega,
  formatarMoedaEntrega,
  SITUACOES_ENTREGA,
  type EntregaControle,
  type SituacaoEntrega,
} from "@/lib/controle-entregas";
import { abrirPdfGerandoNoVisualizadorPagina } from "@/lib/pdf-viewer";
import { metaStatusOs } from "@/lib/status-os";

export const MODELOS_RELATORIO_ENTREGAS = [
  { value: "entregas-modelo-1", label: "Entregas - Modelo 1" },
  { value: "entregas-modelo-2", label: "Entregas - Modelo 2 (por entregador)" },
  { value: "entregas-modelo-3", label: "Entregas - Modelo 3 (completo)" },
  { value: "entregas-pendentes", label: "Entregas Pendentes" },
  { value: "entregas-em-rota", label: "Entregas Em Rota" },
  { value: "entregas-finalizadas", label: "Entregas Finalizadas" },
] as const;

export type ModeloRelatorioEntregas =
  (typeof MODELOS_RELATORIO_ENTREGAS)[number]["value"];

export type FiltroRelatorioEntregas = {
  modelo: ModeloRelatorioEntregas;
  ordenarPor: "data_pedido" | "data_finalizado" | "destinatario" | "entregador" | "valor";
  situacao: "" | SituacaoEntrega;
  entregador: string;
  periodo: "pedido" | "finalizado";
  dataInicio: string;
  dataFinal: string;
  busca: string;
};

export type TrabalhoResumoEntrega = {
  numeroOs: number;
  status: string;
  cliente?: { nome?: string } | null;
  paciente?: { nome?: string } | null;
  dataEntrega?: string | null;
  tipoProtese?: string | null;
};

export type LinhaRelatorioEntrega = {
  dataPedido: string;
  dataFinalizado: string;
  destinatario: string;
  entregador: string;
  descricao: string;
  nomeRecebedor: string;
  situacao: string;
  situacaoLabel: string;
  valor: number;
  valorLabel: string;
  numeroOs: string;
  situacaoOs: string;
  clienteOs: string;
  pacienteOs: string;
  dataEntregaOs: string;
  dataOrdenacao: Date;
  entregadorGrupo: string;
};

function extrairNumeroOs(valor?: string) {
  const digits = String(valor || "").replace(/\D/g, "");
  if (!digits) return null;
  const numero = Number.parseInt(digits, 10);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function labelSituacaoOs(status?: string) {
  if (!status) return "";
  return metaStatusOs(status)?.label || status;
}

export function mapaTrabalhosPorOs(trabalhos: TrabalhoResumoEntrega[]) {
  const mapa = new Map<number, TrabalhoResumoEntrega>();
  for (const trabalho of trabalhos) {
    if (Number.isFinite(trabalho.numeroOs)) mapa.set(trabalho.numeroOs, trabalho);
  }
  return mapa;
}

export function linhasRelatorioFromEntregas(
  entregas: EntregaControle[],
  trabalhos: TrabalhoResumoEntrega[] = []
): LinhaRelatorioEntrega[] {
  const mapaOs = mapaTrabalhosPorOs(trabalhos);

  return entregas.map((entrega) => {
    const numeroOs = extrairNumeroOs(entrega.numeroOs);
    const trabalho = numeroOs ? mapaOs.get(numeroOs) : undefined;
    const dataOrdenacao = new Date(
      entrega.dataFinalizado || entrega.dataPedido || Date.now()
    );

    return {
      dataPedido: formatarDataHoraEntrega(entrega.dataPedido),
      dataFinalizado: formatarDataEntrega(entrega.dataFinalizado),
      destinatario: entrega.destinatario,
      entregador: entrega.entregador || "—",
      descricao: entrega.descricao || "—",
      nomeRecebedor: entrega.nomeRecebedor || "—",
      situacao: entrega.situacao,
      situacaoLabel: SITUACOES_ENTREGA[entrega.situacao].label,
      valor: entrega.valor,
      valorLabel: formatarMoedaEntrega(entrega.valor),
      numeroOs: entrega.numeroOs?.trim() || (numeroOs ? String(numeroOs) : "—"),
      situacaoOs: trabalho ? labelSituacaoOs(trabalho.status) : "",
      clienteOs: trabalho?.cliente?.nome?.trim() || "",
      pacienteOs: trabalho?.paciente?.nome?.trim() || "",
      dataEntregaOs: trabalho?.dataEntrega
        ? formatarDataEntrega(trabalho.dataEntrega)
        : "",
      dataOrdenacao,
      entregadorGrupo: entrega.entregador?.trim() || "Sem entregador",
    };
  });
}

export function filtroRelatorioParaControle(filtro: FiltroRelatorioEntregas) {
  return {
    entregador: filtro.entregador || undefined,
    situacao: filtro.situacao || undefined,
    periodo: filtro.periodo,
    dataInicio: filtro.dataInicio || undefined,
    dataFim: filtro.dataFinal || undefined,
    busca: filtro.busca || undefined,
  };
}

export function filtrarLinhasRelatorioEntregas(
  entregas: EntregaControle[],
  filtro: FiltroRelatorioEntregas,
  trabalhos: TrabalhoResumoEntrega[] = []
) {
  let lista = filtrarEntregas(entregas, filtroRelatorioParaControle(filtro));

  if (filtro.modelo === "entregas-pendentes") {
    lista = lista.filter((item) => item.situacao === "pendente");
  } else if (filtro.modelo === "entregas-em-rota") {
    lista = lista.filter((item) => item.situacao === "em_rota");
  } else if (filtro.modelo === "entregas-finalizadas") {
    lista = lista.filter((item) => item.situacao === "entregue");
  }

  return linhasRelatorioFromEntregas(lista, trabalhos);
}

export function ordenarLinhasRelatorioEntregas(
  linhas: LinhaRelatorioEntrega[],
  ordenarPor: FiltroRelatorioEntregas["ordenarPor"]
) {
  const copia = [...linhas];
  copia.sort((a, b) => {
    if (ordenarPor === "destinatario") {
      return a.destinatario.localeCompare(b.destinatario, "pt-BR");
    }
    if (ordenarPor === "entregador") {
      return a.entregador.localeCompare(b.entregador, "pt-BR");
    }
    if (ordenarPor === "valor") return b.valor - a.valor;
    if (ordenarPor === "data_finalizado") {
      const af = a.dataFinalizado === "—" ? "" : a.dataFinalizado;
      const bf = b.dataFinalizado === "—" ? "" : b.dataFinalizado;
      return af.localeCompare(bf, "pt-BR");
    }
    return a.dataPedido.localeCompare(b.dataPedido, "pt-BR");
  });
  return copia;
}

export function agruparPorEntregador(linhas: LinhaRelatorioEntrega[]) {
  const grupos = new Map<string, LinhaRelatorioEntrega[]>();
  for (const linha of linhas) {
    const chave = linha.entregadorGrupo;
    const lista = grupos.get(chave) || [];
    lista.push(linha);
    grupos.set(chave, lista);
  }
  return Array.from(grupos.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR")
  );
}

export function periodoLabelRelatorioEntregas(filtro: FiltroRelatorioEntregas) {
  const campo = filtro.periodo === "finalizado" ? "Data Finalizado" : "Data Pedido";
  if (filtro.dataInicio && filtro.dataFinal) {
    return `${campo}: ${filtro.dataInicio} a ${filtro.dataFinal}`;
  }
  return campo;
}

export function modeloLabelRelatorioEntregas(modelo: ModeloRelatorioEntregas) {
  return (
    MODELOS_RELATORIO_ENTREGAS.find((item) => item.value === modelo)?.label || modelo
  );
}

function escCsv(valor: string | number) {
  const texto = String(valor ?? "");
  if (/[;"\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function exportarRelatorioEntregasCsv(
  linhas: LinhaRelatorioEntrega[],
  modelo: ModeloRelatorioEntregas
) {
  const header = [
    "Data Pedido",
    "Data Finalizado",
    "Destinatário",
    "Entregador",
    "Descrição",
    "Nome Recebedor",
    "Situação",
    "Valor",
    "OS",
    "Situação OS",
    "Cliente OS",
    "Paciente OS",
    "Data Entrega OS",
  ].join(";");

  const rows: string[] = [];

  if (modelo === "entregas-modelo-2") {
    for (const [entregador, grupo] of agruparPorEntregador(linhas)) {
      rows.push(
        [
          escCsv(`Entregador: ${entregador}`),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ].join(";")
      );
      for (const linha of grupo) {
        rows.push(linhaParaCsv(linha));
      }
    }
  } else {
    for (const linha of linhas) rows.push(linhaParaCsv(linha));
  }

  const csv = ["\uFEFF", header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorio-entregas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function linhaParaCsv(linha: LinhaRelatorioEntrega) {
  return [
    escCsv(linha.dataPedido),
    escCsv(linha.dataFinalizado),
    escCsv(linha.destinatario),
    escCsv(linha.entregador),
    escCsv(linha.descricao),
    escCsv(linha.nomeRecebedor),
    escCsv(linha.situacaoLabel),
    escCsv(linha.valorLabel),
    escCsv(linha.numeroOs),
    escCsv(linha.situacaoOs),
    escCsv(linha.clienteOs),
    escCsv(linha.pacienteOs),
    escCsv(linha.dataEntregaOs),
  ].join(";");
}

export async function carregarTrabalhosParaRelatorioEntregas(): Promise<
  TrabalhoResumoEntrega[]
> {
  try {
    const res = await fetch("/api/trabalhos", { cache: "no-store" });
    const data = res.ok ? await res.json() : [];
    if (!Array.isArray(data)) return [];
    return data
      .map((item: Record<string, unknown>) => ({
        numeroOs: Number(item.numeroOs),
        status: String(item.status || ""),
        cliente: item.cliente as TrabalhoResumoEntrega["cliente"],
        paciente: item.paciente as TrabalhoResumoEntrega["paciente"],
        dataEntrega: (item.dataEntrega as string | null) ?? null,
        tipoProtese: (item.tipoProtese as string | null) ?? null,
      }))
      .filter((item) => Number.isFinite(item.numeroOs) && item.numeroOs > 0);
  } catch {
    return [];
  }
}

export async function imprimirRelatorioEntregas(
  linhas: LinhaRelatorioEntrega[],
  filtro: FiltroRelatorioEntregas,
  _janelaReservada?: Window | null
) {
  const tituloModelo = modeloLabelRelatorioEntregas(filtro.modelo);
  const periodo = periodoLabelRelatorioEntregas(filtro);
  await abrirPdfGerandoNoVisualizadorPagina(
    async () => {
      const { gerarRelatorioEntregasPdf } = await import("@/lib/relatorios-impressao-pdf");
      return gerarRelatorioEntregasPdf(linhas, tituloModelo, periodo, filtro.modelo);
    },
    `Relatório Entregas — ${tituloModelo}`,
    "relatorio-entregas.pdf",
    { subtitulo: periodo }
  );
}

export function filtroRelatorioFromTela(params: {
  entregador?: string;
  situacao?: string;
  filtroCard?: SituacaoEntrega | "todos";
  periodo?: "pedido" | "finalizado";
  dataInicio?: string;
  dataFim?: string;
  busca?: string;
  modelo?: ModeloRelatorioEntregas;
}): FiltroRelatorioEntregas {
  const padrao = filtrosRelatorioPadraoEntregas();
  const situacaoCard =
    params.filtroCard && params.filtroCard !== "todos" ? params.filtroCard : "";
  const situacaoFiltro = (params.situacao || situacaoCard || "") as "" | SituacaoEntrega;

  return {
    ...padrao,
    modelo: params.modelo ?? padrao.modelo,
    entregador: params.entregador ?? "",
    situacao: situacaoFiltro,
    periodo: params.periodo ?? padrao.periodo,
    dataInicio: params.dataInicio ?? padrao.dataInicio,
    dataFinal: params.dataFim ?? padrao.dataFinal,
    busca: params.busca ?? "",
  };
}

export function gerarLinhasRelatorioEntregas(
  entregas: EntregaControle[],
  filtro: FiltroRelatorioEntregas,
  trabalhos: TrabalhoResumoEntrega[] = []
) {
  const filtradas = filtrarLinhasRelatorioEntregas(entregas, filtro, trabalhos);
  return ordenarLinhasRelatorioEntregas(filtradas, filtro.ordenarPor);
}

export function filtrosRelatorioPadraoEntregas(): FiltroRelatorioEntregas {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(hoje);
  inicio.setDate(1);
  const fim = new Date(hoje);
  fim.setMonth(hoje.getMonth() + 1, 0);

  const br = (date: Date) =>
    date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return {
    modelo: "entregas-modelo-1",
    ordenarPor: "data_pedido",
    situacao: "",
    entregador: "",
    periodo: "pedido",
    dataInicio: br(inicio),
    dataFinal: br(fim),
    busca: "",
  };
}
