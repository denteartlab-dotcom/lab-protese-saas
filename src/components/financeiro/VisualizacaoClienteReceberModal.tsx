"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronsUpDown,
  Eye,
  FileSpreadsheet,
  Mail,
  Pencil,
  Printer,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { SelectPesquisavel } from "@/components/SelectPesquisavel";
import { BotoesExtratoCompartilhar } from "@/components/financeiro/BotoesExtratoCompartilhar";
import { EnviarExtratoWhatsappModal } from "@/components/financeiro/EnviarExtratoWhatsappModal";
import { parseBrDate } from "@/lib/datas-br";
import type { LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
import {
  montarExtratoIndividual,
  type LinhaExtratoIndividualComSaldo,
} from "@/lib/extrato-individual-dados";
import { parseParcelaNaDescricao } from "@/lib/fatura-financeiro-util";
import { prepararAbaPdf } from "@/lib/pdf-viewer";
import { abrirPdfBlobGerandoNoVisualizadorUnificado } from "@/lib/pdf-viewer-unificado";
import type { TrabalhoRelatorioFatura } from "@/lib/relatorio-faturas-modelo3-dados";
import { filtrarTrabalhosCliente } from "@/lib/relatorio-faturas-modelo3-dados";
import { baixarCsv } from "@/lib/exportar-csv";
import { exportarExtratoRelatorioExcel } from "@/lib/extrato-relatorio-export";
import type { ModeloRelatorioReceitas } from "@/lib/relatorio-receitas-modelos";
import { cn } from "@/lib/utils";

export type FiltrosPainelContasReceber = {
  dataInicio: string;
  dataFinal: string;
  situacao: string;
};

export type LancamentoClienteModal = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome: string } | null;
  cobrancaAsaas?: {
    id?: string;
    bankSlipUrl?: string | null;
    invoiceUrl?: string | null;
  } | null;
};

export type ClienteReceberModal = {
  clienteId?: string;
  nome: string;
  lancamentos: LancamentoClienteModal[];
  aReceber: number;
  recebido: number;
  adiantamentos: number;
  naoFaturados: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  cliente: ClienteReceberModal | null;
  clientes: ClienteReceberModal[];
  trabalhos?: TrabalhoRelatorioFatura[];
  onClienteChange: (cliente: ClienteReceberModal) => void;
  money: (value: number) => string;
  formatDate: (iso: string) => string;
  numeroFatura: (l: LancamentoClienteModal) => number;
  saldoFatura: (l: LancamentoClienteModal) => number;
  recebidoNaFatura: (l: LancamentoClienteModal) => number;
  isFaturaContasReceber: (l: LancamentoClienteModal) => boolean;
  referenciaLancamento: (l: LancamentoClienteModal) => string;
  situacaoFaturaLabel: (l: LancamentoClienteModal) => {
    label: string;
    aReceber: boolean;
    vencido?: boolean;
  };
  onReceber: () => void;
  onReceberFatura?: (l: LancamentoClienteModal) => void;
  onImprimirNota: () => void;
  onVisualizarFatura: (l: LancamentoClienteModal) => void;
  onImprimirFatura: (l: LancamentoClienteModal) => void;
  onEditarFatura: (l: LancamentoClienteModal) => void;
  onExcluirFatura: (l: LancamentoClienteModal) => void;
  onEstornarRecebimento: (l: LancamentoClienteModal) => void;
  onImprimirRecibo: (l: LancamentoClienteModal) => void;
  onDetalheRecebimento: (l: LancamentoClienteModal) => void;
  filtrosPainel: FiltrosPainelContasReceber;
  clienteTelefone?: string | null;
  onRecarregarDados?: () => void | Promise<void>;
};

type ExtratoModeloModal = "1" | "2" | "3";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const labelClass = "mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#6b7280]";
const selectClass =
  "h-[32px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";
const thFaturasClass =
  "border-b border-[#e5e7eb] bg-[#f5f5f5] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af] whitespace-nowrap";
const tdFaturasClass = "border-b border-[#f0f0f0] px-3 py-2.5 text-[11px] text-[#374151]";
const tdFaturasTotalClass =
  "border-t border-[#e5e7eb] bg-[#f5f5f5] px-3 py-2.5 text-[11px] font-semibold text-[#374151]";
const thRecebClass =
  "border-b border-[#d8dce8] bg-[#e8eaf0] px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#4b5563] whitespace-nowrap";
const thExtratoClass =
  "border-b border-[#2d3340] bg-[#3b3b4f] px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-white whitespace-nowrap";
const btnOpcaoClass =
  "inline-flex h-7 w-7 items-center justify-center rounded transition hover:bg-[#f3f4f6]";

function ThSort({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(thRecebClass, align === "right" && "text-right")}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-60" />
      </span>
    </th>
  );
}

function parcelaLabel(descricao: string) {
  const p = parseParcelaNaDescricao(descricao);
  if (!p) return "1 / 1";
  return `${p.numero} / ${p.total}`;
}

function observacaoLinha(descricao: string) {
  if (!descricao.toLowerCase().startsWith("cobrança os")) return "";
  const partes = descricao.replace(/@@trab:[a-zA-Z0-9_,-]+@@/g, "").split(" - ");
  return partes.slice(1).join(" - ").replace(/\(\d+\s*\/\s*\d+\)\s*$/, "").trim();
}

function observacaoRecebimento(descricao: string) {
  const obs = observacaoLinha(descricao);
  if (obs) return obs;
  const texto = descricao.replace(/@@trab:[a-zA-Z0-9_,-]+@@/g, "").trim();
  if (texto.toLowerCase().startsWith("cobrança os")) return "";
  return texto;
}

function parseDataMesAno(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})/);
  if (!match) return { mes: new Date().getMonth(), ano: new Date().getFullYear() };
  return { mes: Number(match[2]) - 1, ano: Number(match[1]) };
}

function mesAnoDeBr(data: string) {
  if (!data.trim()) return null;
  const parsed = parseBrDate(data);
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return { mes: parsed.getMonth(), ano: parsed.getFullYear() };
}

function situacaoModalDePainel(situacaoPainel: string) {
  if (situacaoPainel === "receber") return "a_receber";
  if (situacaoPainel === "atraso") return "atraso";
  return "todos";
}

function mesAnoInicialSincronizado(
  filtros: FiltrosPainelContasReceber,
  lancamentos: LancamentoClienteModal[]
) {
  const ini = mesAnoDeBr(filtros.dataInicio);
  const fim = mesAnoDeBr(filtros.dataFinal);
  if (ini && fim && ini.mes === fim.mes && ini.ano === fim.ano) return ini;
  if (ini) return ini;
  if (fim) return fim;
  if (lancamentos.length > 0) return parseDataMesAno(lancamentos[0].data);
  const hoje = new Date();
  return { mes: hoje.getMonth(), ano: hoje.getFullYear() };
}

function lancamentoNoPeriodoPainel(
  dataIso: string,
  filtros: FiltrosPainelContasReceber
) {
  if (!filtros.dataInicio && !filtros.dataFinal) return true;
  const data = new Date(dataIso);
  const inicio = filtros.dataInicio ? parseBrDate(filtros.dataInicio) : null;
  const fim = filtros.dataFinal ? parseBrDate(filtros.dataFinal) : null;
  if (inicio && !Number.isNaN(inicio.getTime())) {
    inicio.setHours(0, 0, 0, 0);
    if (data < inicio) return false;
  }
  if (fim && !Number.isNaN(fim.getTime())) {
    fim.setHours(23, 59, 59, 999);
    if (data > fim) return false;
  }
  return true;
}

function periodoMesAno(mes: number, ano: number) {
  const inicio = new Date(ano, mes, 1);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(ano, mes + 1, 0);
  fim.setHours(23, 59, 59, 999);
  return { inicio, fim };
}

function badgeFormaPagamento(forma: string | null | undefined) {
  if (!forma) return <span className="text-[#9ca3af]">—</span>;
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-[10px] font-medium text-[#1d4ed8]">
      {forma}
    </span>
  );
}

function descricaoExtratoModal(linha: LinhaExtratoIndividualComSaldo) {
  if (linha.tipo === "pagamento" || linha.tipo === "desconto") {
    const forma = (linha.servico || "")
      .replace(/^Pagamento\s*/i, "")
      .replace(/[()]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/^pix/, "px");
    return `Recebimento ${forma || "externo"}`;
  }
  return linha.servico;
}

function badgeSituacaoFatura(
  l: LancamentoClienteModal,
  situacaoFaturaLabel: (l: LancamentoClienteModal) => {
    label: string;
    aReceber: boolean;
    vencido?: boolean;
  },
  onReceberFatura?: (l: LancamentoClienteModal) => void
) {
  const sit = situacaoFaturaLabel(l);
  if (sit.vencido || sit.label.toUpperCase().includes("VENCID")) {
    return (
      <span className="inline-block whitespace-nowrap rounded bg-[#dc2626] px-3 py-1 text-[10px] font-semibold text-white">
        Vencido
      </span>
    );
  }
  if (sit.aReceber) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onReceberFatura?.(l);
        }}
        className="text-[11px] font-semibold capitalize text-[#2563eb] hover:underline"
      >
        A receber
      </button>
    );
  }
  const label = sit.label;
  if (label.toUpperCase().includes("RECEB")) {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-[#dcfce7] px-3 py-0.5 text-[10px] font-semibold text-[#16a34a]">
        Recebido
      </span>
    );
  }
  if (label.toUpperCase().includes("CANCEL")) {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-[#f3f4f6] px-3 py-0.5 text-[10px] font-semibold text-[#6b7280]">
        Cancelado
      </span>
    );
  }
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-[#f3f4f6] px-3 py-0.5 text-[10px] font-semibold text-[#6b7280]">
      {label}
    </span>
  );
}

export function VisualizacaoClienteReceberModal({
  open,
  onClose,
  cliente,
  clientes,
  trabalhos = [],
  onClienteChange,
  money,
  formatDate,
  numeroFatura,
  saldoFatura,
  recebidoNaFatura,
  isFaturaContasReceber,
  referenciaLancamento,
  situacaoFaturaLabel,
  onReceber,
  onReceberFatura,
  onImprimirNota,
  onVisualizarFatura,
  onImprimirFatura,
  onEditarFatura,
  onExcluirFatura,
  onEstornarRecebimento,
  onImprimirRecibo,
  onDetalheRecebimento,
  filtrosPainel,
  clienteTelefone,
  onRecarregarDados,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [aba, setAba] = useState<"faturas" | "recebimentos" | "extrato">("faturas");
  const [mes, setMes] = useState(new Date().getMonth());
  const [ano, setAno] = useState(new Date().getFullYear());
  const [formaPagamento, setFormaPagamento] = useState("todos");
  const [situacao, setSituacao] = useState("a_receber");
  const [busca, setBusca] = useState("");
  const [extratoModelo, setExtratoModelo] = useState<ExtratoModeloModal>("1");
  const [buscaExtrato, setBuscaExtrato] = useState("");
  const [gerandoExtrato, setGerandoExtrato] = useState(false);
  const [whatsappExtratoAberto, setWhatsappExtratoAberto] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !cliente) return;
    setAba("faturas");
    setFormaPagamento("todos");
    setSituacao(situacaoModalDePainel(filtrosPainel.situacao));
    setBusca("");
    setBuscaExtrato("");
    setExtratoModelo("1");
    const { mes: mesIni, ano: anoIni } = mesAnoInicialSincronizado(
      filtrosPainel,
      cliente.lancamentos
    );
    setMes(mesIni);
    setAno(anoIni);
  }, [
    open,
    cliente?.clienteId,
    cliente?.nome,
    filtrosPainel.dataInicio,
    filtrosPainel.dataFinal,
    filtrosPainel.situacao,
  ]);

  useEffect(() => {
    if (!open || aba !== "extrato") return;
    void onRecarregarDados?.();
  }, [open, aba, onRecarregarDados]);

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const c of clientes) {
      for (const l of c.lancamentos) {
        set.add(parseDataMesAno(l.data).ano);
      }
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [clientes]);

  const formasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const l of cliente?.lancamentos ?? []) {
      if (l.formaPagamento) set.add(l.formaPagamento);
    }
    return ["todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [cliente]);

  const lancamentosMes = useMemo(() => {
    if (!cliente) return [];
    return cliente.lancamentos.filter((l) => {
      if (!lancamentoNoPeriodoPainel(l.data, filtrosPainel)) return false;
      const { mes: lm, ano: la } = parseDataMesAno(l.data);
      if (lm !== mes || la !== ano) return false;
      if (formaPagamento !== "todos" && l.formaPagamento !== formaPagamento) return false;
      return true;
    });
  }, [cliente, mes, ano, formaPagamento, filtrosPainel]);

  const lancamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return lancamentosMes.filter((l) => {
      if (situacao === "a_receber" && (l.status === "pago" || saldoFatura(l) <= 0.009)) return false;
      if (situacao === "recebidas" && l.status !== "pago") return false;
      if (situacao === "atraso") {
        const venc = new Date(l.data);
        venc.setHours(0, 0, 0, 0);
        if (l.status === "pago" || saldoFatura(l) <= 0.009 || venc >= hoje) return false;
      }
      if (termo) {
        const texto = [
          formatDate(l.data),
          String(numeroFatura(l)),
          l.formaPagamento,
          l.descricao,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!texto.includes(termo)) return false;
      }
      return true;
    });
  }, [lancamentosMes, situacao, busca, formatDate, numeroFatura, saldoFatura]);

  const faturasVisiveis = useMemo(
    () => lancamentosFiltrados.filter(isFaturaContasReceber),
    [lancamentosFiltrados, isFaturaContasReceber]
  );

  const recebimentosVisiveis = useMemo(
    () =>
      lancamentosMes.filter(
        (l) =>
          l.status === "pago" &&
          !l.descricao.toLowerCase().includes("crédito utilizado")
      ),
    [lancamentosMes]
  );

  const totalAReceber = useMemo(
    () =>
      faturasVisiveis
        .filter((l) => l.status !== "pago" && saldoFatura(l) > 0.009)
        .reduce((s, l) => s + saldoFatura(l), 0),
    [faturasVisiveis, saldoFatura]
  );

  const totalValorFaturas = useMemo(
    () => faturasVisiveis.reduce((s, l) => s + l.valor, 0),
    [faturasVisiveis]
  );

  const totalRecebidoFaturas = useMemo(
    () => faturasVisiveis.reduce((s, l) => s + recebidoNaFatura(l), 0),
    [faturasVisiveis, recebidoNaFatura]
  );

  const totalSaldoFaturas = useMemo(
    () => faturasVisiveis.reduce((s, l) => s + saldoFatura(l), 0),
    [faturasVisiveis, saldoFatura]
  );

  const trabalhosCliente = useMemo(
    () =>
      filtrarTrabalhosCliente(
        trabalhos,
        cliente?.clienteId,
        cliente?.nome
      ),
    [trabalhos, cliente?.clienteId, cliente?.nome]
  );

  const extratoDados = useMemo(() => {
    if (!cliente) return { linhas: [] as LinhaExtratoIndividualComSaldo[], resumo: null };
    const { inicio, fim } = periodoMesAno(mes, ano);
    return montarExtratoIndividual(
      cliente.lancamentos as LancamentoContasReceber[],
      trabalhosCliente,
      cliente.nome,
      {
        dataInicio: inicio,
        dataFinal: fim,
        clienteId: cliente.clienteId,
      }
    );
  }, [cliente, trabalhosCliente, mes, ano]);

  const extratoLinhas = useMemo(() => {
    const termo = buscaExtrato.trim().toLowerCase();
    return extratoDados.linhas.filter((linha) => {
      if (linha.tipo === "saldo_anterior") return false;
      if (!termo) return true;
      const texto = [
        linha.dataFatura,
        linha.numFatura,
        linha.os,
        linha.servico,
        linha.paciente,
        linha.numDente,
      ]
        .join(" ")
        .toLowerCase();
      return texto.includes(termo);
    });
  }, [extratoDados.linhas, buscaExtrato]);

  const saldoAnteriorExtrato = extratoDados.resumo?.saldoAnterior ?? 0;
  const saldoFinalExtrato = extratoDados.resumo?.saldoTotal ?? 0;

  const totalRecebimentosMes = useMemo(
    () => recebimentosVisiveis.reduce((s, l) => s + l.valor, 0),
    [recebimentosVisiveis]
  );

  const totalLinhaAReceber = cliente?.aReceber ?? 0;
  const adiantamentosCliente = cliente?.adiantamentos ?? 0;
  const mesLabel = MESES[mes];
  const chaveCliente = cliente?.clienteId ?? cliente?.nome ?? "";

  function opcoesExtratoModalPdf() {
    const { inicio, fim } = periodoMesAno(mes, ano);
    return {
      periodoAtivo: true,
      dataInicio: inicio.toLocaleDateString("pt-BR"),
      dataFinal: fim.toLocaleDateString("pt-BR"),
      clienteId: cliente?.clienteId,
    };
  }

  async function gerarExtratoPdfBlob() {
    if (!cliente) throw new Error("Cliente não selecionado");
    const opcoes = opcoesExtratoModalPdf();
    const lancamentos = cliente.lancamentos as LancamentoContasReceber[];

    if (extratoModelo === "3") {
      const { gerarRelatorioExtrato3PacienteSmartPdf } = await import(
        "@/lib/pdf-relatorio-extrato-3-paciente-smart"
      );
      return gerarRelatorioExtrato3PacienteSmartPdf(
        lancamentos,
        trabalhosCliente,
        cliente.nome,
        opcoes
      );
    }
    if (extratoModelo === "2") {
      const { gerarRelatorioExtrato2IndividualSmartPdf } = await import(
        "@/lib/pdf-relatorio-extrato-2-individual-smart"
      );
      return gerarRelatorioExtrato2IndividualSmartPdf(
        lancamentos,
        trabalhosCliente,
        cliente.nome,
        opcoes
      );
    }
    const { gerarRelatorioExtratoIndividualSmartPdf } = await import(
      "@/lib/pdf-relatorio-extrato-individual-smart"
    );
    return gerarRelatorioExtratoIndividualSmartPdf(
      lancamentos,
      trabalhosCliente,
      cliente.nome,
      opcoes
    );
  }

  async function imprimirExtratoPdf() {
    if (!cliente) return;
    setGerandoExtrato(true);
    const janela = prepararAbaPdf();
    try {
      await abrirPdfBlobGerandoNoVisualizadorUnificado(
        gerarExtratoPdfBlob,
        `Extrato — ${cliente.nome}`,
        "extrato-cliente.pdf",
        { janela, origem: "Financeiro · Extrato cliente" }
      );
    } catch {
      janela?.close();
    } finally {
      setGerandoExtrato(false);
    }
  }

  function modeloExtratoRelatorio(): ModeloRelatorioReceitas {
    if (extratoModelo === "3") return "extrato-3-agrupado-paciente";
    if (extratoModelo === "2") return "extrato-2-individual";
    return "extrato-individual";
  }

  function exportarExtratoExcel() {
    if (!cliente) return;
    const { inicio, fim } = periodoMesAno(mes, ano);
    exportarExtratoRelatorioExcel(
      modeloExtratoRelatorio(),
      cliente.lancamentos as LancamentoContasReceber[],
      trabalhosCliente,
      cliente.nome,
      {
        periodoAtivo: true,
        dataInicio: inicio.toLocaleDateString("pt-BR"),
        dataFinal: fim.toLocaleDateString("pt-BR"),
        clienteId: cliente.clienteId,
      }
    );
  }

  function exportarRecebimentosExcel() {
    baixarCsv(
      "recebimentos-cliente.csv",
      ["DATA RECEBIMENTO", "FORMA PAGAMENTO", "VALOR", "OBSERVACAO"],
      recebimentosVisiveis.map((l) => [
        formatDate(l.data),
        l.formaPagamento || "",
        l.valor,
        observacaoRecebimento(l.descricao),
      ])
    );
  }

  if (!open || !mounted || !cliente) return null;

  return createPortal(
    <I18nPortal>
      <div className="fixed inset-0 z-[65] flex p-2 sm:p-3">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex h-full w-full flex-col rounded-sm border border-[#d1d5db] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-3">
            <div>
              <SelectPesquisavel
                label="Cliente"
                value={chaveCliente}
                onChange={(valor) => {
                  const escolhido = clientes.find(
                    (c) => (c.clienteId ?? c.nome) === valor
                  );
                  if (escolhido) onClienteChange(escolhido);
                }}
                inputClassName={selectClass}
                menuEmPortal
                options={clientes.map((c) => ({
                  value: c.clienteId ?? c.nome,
                  label: c.nome,
                }))}
              />
            </div>
            <div>
              <label className={labelClass}>Período</label>
              <div className="flex gap-1.5">
                <select
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  className={cn(selectClass, "flex-1")}
                >
                  {MESES.map((nome, i) => (
                    <option key={nome} value={i}>
                      {nome}
                    </option>
                  ))}
                </select>
                <select
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                  className={cn(selectClass, "w-[5.5rem]")}
                >
                  {anosDisponiveis.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Condições</label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className={selectClass}
              >
                <option value="todos">Forma Pagamento</option>
                {formasDisponiveis
                  .filter((f) => f !== "todos")
                  .map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Situação</label>
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                className={selectClass}
              >
                <option value="a_receber">A Receber</option>
                <option value="recebidas">Recebidas</option>
                <option value="atraso">Em atraso</option>
                <option value="todos">Mostrar todos</option>
              </select>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mb-0.5 flex h-8 w-8 items-center justify-center rounded-sm bg-[#dc2626] text-white hover:bg-[#b91c1c]"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 bg-[#ececec] px-6 py-2.5">
          {(
            [
              ["faturas", "Faturas"],
              ["recebimentos", "Recebimentos"],
              ["extrato", "Extrato"],
            ] as const
          ).map(([id, titulo]) => (
            <div key={id} className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setAba(id)}
                className={cn(
                  "min-w-[7rem] text-center text-[13px] font-medium transition",
                  aba === id
                    ? "rounded-md bg-[#4a90d9] px-10 py-1.5 text-white shadow-sm"
                    : "bg-transparent px-4 py-1.5 text-[#1f2937] hover:text-[#111827]"
                )}
              >
                {titulo}
              </button>
            </div>
          ))}
        </div>

        {aba === "faturas" && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#e5e7eb] bg-[#fafafa] px-5 py-4">
            <div className="flex flex-wrap items-start gap-10">
              <div>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-[#4b5563]">Total a Receber</span>
                  <span className="rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-[10px] font-medium text-[#2563eb]">
                    Adiantamentos
                  </span>
                  <span className="text-[10px] font-medium text-[#2563eb]">
                    {money(adiantamentosCliente)}
                  </span>
                </div>
                <p className="text-[26px] font-bold leading-none tracking-tight text-[#2563eb]">
                  R$ {money(totalLinhaAReceber)}
                </p>
              </div>
              <div>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-[#4b5563]">A Receber Faturas</span>
                  <span className="rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-[10px] font-medium text-[#16a34a]">
                    Juros
                  </span>
                  <span className="text-[10px] font-medium text-[#16a34a]">{money(0)}</span>
                </div>
                <p className="text-[26px] font-bold leading-none tracking-tight text-[#16a34a]">
                  R$ {money(totalAReceber)}
                </p>
              </div>
            </div>
            <div className="flex min-w-[260px] flex-1 items-stretch justify-end gap-2 sm:max-w-[420px]">
              <button
                type="button"
                onClick={onReceber}
                className="h-[34px] shrink-0 rounded-sm bg-[#16a34a] px-4 text-[12px] font-semibold text-white hover:bg-[#15803d]"
              >
                {totalAReceber <= 0.009 ? "Lançar Adiantamento" : "Receber"}
              </button>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Procurar"
                className="h-[34px] min-w-0 flex-1 rounded-l border border-[#d1d5db] border-r-0 bg-white px-3 text-[12px] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
              />
              <button
                type="button"
                onClick={() => setBusca("")}
                className="h-[34px] shrink-0 rounded-r border border-[#d1d5db] bg-[#f3f4f6] px-4 text-[12px] text-[#374151] hover:bg-[#e5e7eb]"
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        {aba === "recebimentos" && (
          <div className="shrink-0 border-b border-[#e5e7eb] bg-white px-5 py-4">
            <div className="inline-block min-w-[220px] rounded-md bg-[#f5f5f5] px-5 py-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-medium text-[#6b7280]">Recebimentos</span>
                <span className="rounded-full bg-[#22c55e] px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  {mesLabel} {ano}
                </span>
              </div>
              <p className="text-[28px] font-bold leading-none text-[#22c55e]">
                R$ {money(totalRecebimentosMes)}
              </p>
            </div>
          </div>
        )}

        {aba === "extrato" && (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#e5e7eb] bg-[#fafafa] px-4 py-2.5">
            <div className="inline-flex items-center gap-1 rounded-sm border border-[#d1d5db] bg-white p-1">
              <button
                type="button"
                title="Imprimir"
                disabled={gerandoExtrato}
                onClick={() => void imprimirExtratoPdf()}
                className="flex h-8 w-8 items-center justify-center rounded-sm text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Enviar por e-mail"
                className="flex h-8 w-8 items-center justify-center rounded-sm text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                <Mail className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Atualizar"
                onClick={() => setBuscaExtrato("")}
                className="flex h-8 w-8 items-center justify-center rounded-sm text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="PDF"
                disabled={gerandoExtrato}
                onClick={() => void imprimirExtratoPdf()}
                className="flex h-8 items-center rounded-sm bg-[#9ca3af] px-2.5 text-[11px] font-semibold text-white hover:bg-[#6b7280] disabled:opacity-50"
              >
                PDF
              </button>
              <button
                type="button"
                title="Exportar Excel"
                onClick={exportarExtratoExcel}
                className="flex h-8 w-8 items-center justify-center rounded-sm text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                <FileSpreadsheet className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#374151]">
              {(
                [
                  ["1", "Extrato Modelo 1"],
                  ["2", "Extrato Modelo 2"],
                  ["3", "Extrato Modelo 3 (agrupado por paciente)"],
                ] as const
              ).map(([valor, rotulo]) => (
                <label key={valor} className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="extrato-modelo"
                    checked={extratoModelo === valor}
                    onChange={() => setExtratoModelo(valor)}
                    className="h-3.5 w-3.5 border-[#d1d5db] text-[#4a90d9] focus:ring-[#4a90d9]"
                  />
                  {rotulo}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto bg-white px-5 py-2">
          {aba === "faturas" && (
            <div className="overflow-x-auto pb-3">
              <table className="w-full min-w-[1050px] border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className={thFaturasClass}>Vencimento</th>
                    <th className={cn(thFaturasClass, "text-center")}>Fatura</th>
                    <th className={cn(thFaturasClass, "text-center")}>Parc.</th>
                    <th className={thFaturasClass}>Forma</th>
                    <th className={thFaturasClass}>Observação</th>
                    <th className={cn(thFaturasClass, "text-right")}>Valor</th>
                    <th className={cn(thFaturasClass, "text-right")}>Recebido</th>
                    <th className={cn(thFaturasClass, "text-right")}>Saldo</th>
                    <th className={cn(thFaturasClass, "text-center")}>Situação</th>
                    <th className={cn(thFaturasClass, "text-right")}>Opções</th>
                  </tr>
                </thead>
                <tbody>
                  {faturasVisiveis.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className={cn(tdFaturasClass, "py-12 text-center text-[#9ca3af]")}
                      >
                        Nenhuma fatura encontrada para o período e filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    faturasVisiveis.map((l) => {
                      const saldo = saldoFatura(l);
                      return (
                        <tr
                          key={l.id}
                          className="cursor-pointer bg-white hover:bg-[#fafafa]"
                          onClick={() => onVisualizarFatura(l)}
                        >
                          <td className={tdFaturasClass}>{formatDate(l.data)}</td>
                          <td className={cn(tdFaturasClass, "text-center")}>
                            {numeroFatura(l)}
                          </td>
                          <td className={cn(tdFaturasClass, "text-center")}>
                            {parcelaLabel(l.descricao)}
                          </td>
                          <td className={tdFaturasClass}>
                            {badgeFormaPagamento(l.formaPagamento)}
                          </td>
                          <td className={cn(tdFaturasClass, "max-w-[14rem] truncate text-[#6b7280]")}>
                            {observacaoLinha(l.descricao)}
                          </td>
                          <td className={cn(tdFaturasClass, "text-right tabular-nums")}>
                            {money(l.valor)}
                          </td>
                          <td className={cn(tdFaturasClass, "text-right tabular-nums")}>
                            {money(recebidoNaFatura(l))}
                          </td>
                          <td
                            className={cn(
                              tdFaturasClass,
                              "text-right font-semibold tabular-nums text-[#16a34a]"
                            )}
                          >
                            {money(saldo)}
                          </td>
                          <td className={cn(tdFaturasClass, "text-center")}>
                            {badgeSituacaoFatura(l, situacaoFaturaLabel, onReceberFatura)}
                          </td>
                          <td
                            className={cn(tdFaturasClass, "text-right")}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                title="Itens da fatura"
                                onClick={() => onVisualizarFatura(l)}
                                className={cn(btnOpcaoClass, "text-[#4a90d9]")}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Imprimir fatura"
                                onClick={() => onImprimirFatura(l)}
                                className={cn(btnOpcaoClass, "text-[#6b7280]")}
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Editar"
                                onClick={() => onEditarFatura(l)}
                                className={cn(btnOpcaoClass, "text-[#6b7280]")}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Excluir"
                                onClick={() => onExcluirFatura(l)}
                                className={cn(btnOpcaoClass, "text-[#dc2626]")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {faturasVisiveis.length > 0 && (
                  <tfoot>
                    <tr>
                      <td className={tdFaturasTotalClass} colSpan={5} />
                      <td className={cn(tdFaturasTotalClass, "text-right tabular-nums")}>
                        {money(totalValorFaturas)}
                      </td>
                      <td className={cn(tdFaturasTotalClass, "text-right tabular-nums")}>
                        {money(totalRecebidoFaturas)}
                      </td>
                      <td
                        className={cn(
                          tdFaturasTotalClass,
                          "text-right tabular-nums text-[#16a34a]"
                        )}
                      >
                        {money(totalSaldoFaturas)}
                      </td>
                      <td className={tdFaturasTotalClass} colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {aba === "recebimentos" && (
            <div className="overflow-x-auto pb-3">
              <table className="w-full min-w-[720px] border-collapse text-[11px]">
                <thead>
                  <tr>
                    <ThSort>Data Recebimento</ThSort>
                    <ThSort>Forma Pagamento</ThSort>
                    <ThSort align="right">Valor</ThSort>
                    <ThSort>Observacao</ThSort>
                  </tr>
                </thead>
                <tbody>
                  {recebimentosVisiveis.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="border-b border-[#f0f0f0] px-4 py-12 text-center text-[#9ca3af]"
                      >
                        Nenhum recebimento encontrado para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    recebimentosVisiveis.map((l) => (
                      <tr
                        key={l.id}
                        className="cursor-pointer bg-white hover:bg-[#fafafa]"
                        onClick={() => onDetalheRecebimento(l)}
                      >
                        <td className="border-b border-[#f0f0f0] px-4 py-2.5 text-[11px] text-[#374151]">
                          {formatDate(l.data)}
                        </td>
                        <td className="border-b border-[#f0f0f0] px-4 py-2.5">
                          {badgeFormaPagamento(l.formaPagamento)}
                        </td>
                        <td className="border-b border-[#f0f0f0] px-4 py-2.5 text-right text-[11px] tabular-nums text-[#374151]">
                          {money(l.valor)}
                        </td>
                        <td className="border-b border-[#f0f0f0] px-4 py-2.5 text-[11px] text-[#6b7280]">
                          {observacaoRecebimento(l.descricao)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {aba === "extrato" && (
            <div className="overflow-x-auto border border-[#c5c9cf] bg-white">
              <table className="w-full min-w-[980px] border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className={thExtratoClass}>Data</th>
                    <th className={thExtratoClass}>Fatura</th>
                    <th className={thExtratoClass}>OS</th>
                    <th className={thExtratoClass}>Descrição</th>
                    <th className={cn(thExtratoClass, "text-center")}>Qtd</th>
                    <th className={thExtratoClass}>Paciente</th>
                    <th className={thExtratoClass}>Num Dente</th>
                    <th className={cn(thExtratoClass, "text-right")}>Valor</th>
                    <th className={cn(thExtratoClass, "text-right")}>
                      <div className="text-[9px] font-normal normal-case opacity-90">
                        Saldo Anterior: R$ {money(saldoAnteriorExtrato)}
                      </div>
                      <div>Saldo</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {extratoLinhas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-3 py-10 text-center text-[#9ca3af]"
                      >
                        Nenhuma movimentação encontrada para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    extratoLinhas.map((linha, idx) => {
                      const pagamento =
                        linha.tipo === "pagamento" || linha.tipo === "desconto";
                      const valor =
                        pagamento ? -Math.abs(linha.subtotal) : linha.subtotal;
                      const cor = pagamento ? "text-[#dc2626]" : "text-[#2563eb]";
                      return (
                        <tr
                          key={`${linha.tipo}-${linha.dataFatura}-${linha.os}-${linha.servico}-${linha.saldo}`}
                          className={idx % 2 === 0 ? "bg-white" : "bg-[#f5f5f5]"}
                        >
                          <td className={cn("px-2.5 py-2", cor)}>{linha.dataFatura}</td>
                          <td className={cn("px-2.5 py-2", pagamento ? "text-[#374151]" : cor)}>
                            {linha.numFatura}
                          </td>
                          <td className={cn("px-2.5 py-2", pagamento ? "text-[#374151]" : cor)}>
                            {linha.os}
                          </td>
                          <td className={cn("px-2.5 py-2", cor)}>
                            {descricaoExtratoModal(linha)}
                          </td>
                          <td
                            className={cn(
                              "px-2.5 py-2 text-center",
                              pagamento ? "text-[#374151]" : cor
                            )}
                          >
                            {linha.qtd}
                          </td>
                          <td className={cn("px-2.5 py-2", pagamento ? "text-[#374151]" : cor)}>
                            {linha.paciente}
                          </td>
                          <td className={cn("px-2.5 py-2", pagamento ? "text-[#374151]" : cor)}>
                            {linha.numDente}
                          </td>
                          <td className={cn("px-2.5 py-2 text-right tabular-nums", cor)}>
                            {pagamento ? `-${money(Math.abs(valor))}` : money(valor)}
                          </td>
                          <td className="px-2.5 py-2 text-right tabular-nums text-[#111827]">
                            {money(linha.saldo)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {extratoLinhas.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#3b3b4f] text-white">
                      <td colSpan={8} />
                      <td className="px-2.5 py-2.5 text-right text-[12px] font-bold tabular-nums">
                        Saldo: R$ {money(saldoFinalExtrato)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {aba === "extrato" ? (
          <div className="shrink-0 border-t border-[#e5e7eb] bg-white px-4 py-3">
            <BotoesExtratoCompartilhar
              onExcel={exportarExtratoExcel}
              onWhatsapp={() => setWhatsappExtratoAberto(true)}
              processando={gerandoExtrato}
            />
          </div>
        ) : null}
      </div>

      {cliente ? (
        <EnviarExtratoWhatsappModal
          open={whatsappExtratoAberto}
          onClose={() => setWhatsappExtratoAberto(false)}
          clienteNome={cliente.nome}
          telefoneInicial={clienteTelefone}
          gerarPdf={gerarExtratoPdfBlob}
        />
      ) : null}
    </div>
    </I18nPortal>,
    document.body
  );
}
