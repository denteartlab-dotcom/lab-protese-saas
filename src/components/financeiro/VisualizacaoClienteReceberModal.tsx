"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Pencil, Printer, Trash2, X } from "lucide-react";
import { parseBrDate } from "@/lib/datas-br";
import { parseParcelaNaDescricao } from "@/lib/fatura-financeiro";
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
  onClienteChange: (cliente: ClienteReceberModal) => void;
  money: (value: number) => string;
  formatDate: (iso: string) => string;
  numeroFatura: (l: LancamentoClienteModal) => number;
  saldoFatura: (l: LancamentoClienteModal) => number;
  recebidoNaFatura: (l: LancamentoClienteModal) => number;
  isFaturaContasReceber: (l: LancamentoClienteModal) => boolean;
  referenciaLancamento: (l: LancamentoClienteModal) => string;
  situacaoFaturaLabel: (l: LancamentoClienteModal) => { label: string; aReceber: boolean };
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
};

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
const thClass =
  "border-b border-[#e5e7eb] bg-[#f5f5f5] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[#6b7280] whitespace-nowrap";
const tdClass = "border-b border-[#f0f0f0] px-3 py-2 text-[11px] text-[#374151]";
const thFaturasClass = thClass;
const tdFaturasClass = tdClass;
const btnOpcaoClass =
  "inline-flex h-7 w-7 items-center justify-center rounded transition hover:bg-[#f3f4f6]";

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

function badgeFormaPagamento(forma: string | null | undefined) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-[10px] font-medium text-[#2563eb]">
      {forma || "—"}
    </span>
  );
}

function badgeSituacaoFatura(
  l: LancamentoClienteModal,
  situacaoFaturaLabel: (l: LancamentoClienteModal) => { label: string; aReceber: boolean }
) {
  const sit = situacaoFaturaLabel(l);
  if (sit.aReceber) {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-[#dbeafe] px-3 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
        A Receber
      </span>
    );
  }
  const label = sit.label;
  if (label.toUpperCase().includes("VENCID")) {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-[#fee2e2] px-3 py-0.5 text-[10px] font-semibold text-[#dc2626]">
        Vencido
      </span>
    );
  }
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
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [aba, setAba] = useState<"faturas" | "recebimentos" | "extrato">("faturas");
  const [mes, setMes] = useState(new Date().getMonth());
  const [ano, setAno] = useState(new Date().getFullYear());
  const [formaPagamento, setFormaPagamento] = useState("todos");
  const [situacao, setSituacao] = useState("a_receber");
  const [busca, setBusca] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !cliente) return;
    setAba("faturas");
    setFormaPagamento("todos");
    setSituacao(situacaoModalDePainel(filtrosPainel.situacao));
    setBusca("");
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

  const lancamentosFiltrados = useMemo(() => {
    if (!cliente) return [];
    const termo = busca.trim().toLowerCase();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return cliente.lancamentos.filter((l) => {
      if (!lancamentoNoPeriodoPainel(l.data, filtrosPainel)) return false;
      const { mes: lm, ano: la } = parseDataMesAno(l.data);
      if (lm !== mes || la !== ano) return false;
      if (formaPagamento !== "todos" && l.formaPagamento !== formaPagamento) return false;
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
  }, [
    cliente,
    mes,
    ano,
    formaPagamento,
    situacao,
    busca,
    filtrosPainel,
    formatDate,
    numeroFatura,
    saldoFatura,
  ]);

  const faturasVisiveis = useMemo(
    () => lancamentosFiltrados.filter(isFaturaContasReceber),
    [lancamentosFiltrados, isFaturaContasReceber]
  );

  const recebimentosVisiveis = useMemo(
    () =>
      lancamentosFiltrados.filter(
        (l) => l.status === "pago" && !l.descricao.toLowerCase().includes("crédito utilizado")
      ),
    [lancamentosFiltrados]
  );

  const totalAReceber = useMemo(
    () =>
      faturasVisiveis
        .filter((l) => l.status !== "pago" && saldoFatura(l) > 0.009)
        .reduce((s, l) => s + saldoFatura(l), 0),
    [faturasVisiveis, saldoFatura]
  );

  const extratoLinhas = useMemo(() => {
    const ordenados = [...lancamentosFiltrados].sort(
      (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
    );
    let saldo = 0;
    return ordenados.map((l) => {
      if (l.status === "pago") {
        saldo -= l.valor;
      } else if (isFaturaContasReceber(l)) {
        saldo += saldoFatura(l);
      } else {
        saldo += l.valor;
      }
      return { lancamento: l, saldo };
    });
  }, [lancamentosFiltrados, isFaturaContasReceber, saldoFatura]);

  const totalRecebimentosMes = useMemo(
    () => recebimentosVisiveis.reduce((s, l) => s + l.valor, 0),
    [recebimentosVisiveis]
  );

  const totalLinhaAReceber = cliente?.aReceber ?? 0;
  const adiantamentosCliente = cliente?.adiantamentos ?? 0;
  const mesLabel = MESES[mes];
  const chaveCliente = cliente?.clienteId ?? cliente?.nome ?? "";

  if (!open || !mounted || !cliente) return null;

  return createPortal(
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
              <label className={labelClass}>Cliente</label>
              <select
                value={chaveCliente}
                onChange={(e) => {
                  const escolhido = clientes.find(
                    (c) => (c.clienteId ?? c.nome) === e.target.value
                  );
                  if (escolhido) onClienteChange(escolhido);
                }}
                className={selectClass}
              >
                {clientes.map((c) => (
                  <option key={c.clienteId ?? c.nome} value={c.clienteId ?? c.nome}>
                    {c.nome}
                  </option>
                ))}
              </select>
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
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#e5e7eb] bg-white px-5 py-4">
            <div className="flex flex-wrap items-start gap-8">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-[#374151]">Total a Receber</span>
                  <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 text-[10px] font-medium text-[#2563eb]">
                    Adiantamentos {money(adiantamentosCliente)}
                  </span>
                </div>
                <p className="text-[24px] font-bold leading-none text-[#2563eb]">
                  R$ {money(totalLinhaAReceber)}
                </p>
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-[#374151]">A Receber Faturas</span>
                  <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-medium text-[#16a34a]">
                    Juros {money(0)}
                  </span>
                </div>
                <p className="text-[24px] font-bold leading-none text-[#16a34a]">
                  R$ {money(totalAReceber)}
                </p>
              </div>
            </div>
            <div className="flex min-w-[260px] flex-1 items-stretch justify-end sm:max-w-[420px]">
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

        <div className="min-h-0 flex-1 overflow-auto bg-white px-5 py-2">
          {aba === "faturas" && (
            <div className="overflow-x-auto">
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
                        <tr key={l.id} className="bg-white hover:bg-[#fafafa]">
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
                            {badgeSituacaoFatura(l, situacaoFaturaLabel)}
                          </td>
                          <td className={cn(tdFaturasClass, "text-right")}>
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                title="Visualizar"
                                onClick={() => onVisualizarFatura(l)}
                                className={cn(btnOpcaoClass, "text-[#4a90d9]")}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Imprimir nota"
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
              </table>
            </div>
          )}

          {aba === "extrato" && (
            <div className="overflow-x-auto border border-[#c5c9cf] bg-white">
              <div className="flex items-center justify-between border-b border-[#d1d5db] bg-[#f3f4f6] px-3 py-2">
                <span className="text-[12px] font-medium text-[#374151]">
                  Extrato financeiro do cliente
                </span>
                <button
                  type="button"
                  onClick={onImprimirNota}
                  disabled={faturasVisiveis.length === 0}
                  className="rounded-sm border border-[#4a90d9] bg-white px-3 py-1 text-[11px] font-medium text-[#4a90d9] hover:bg-[#eff6ff] disabled:opacity-50"
                >
                  Gerar / Imprimir Nota de Cobrança
                </button>
              </div>
              <table className="w-full min-w-[820px] border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className={thClass}>Data</th>
                    <th className={thClass}>Referência</th>
                    <th className={thClass}>Forma</th>
                    <th className={cn(thClass, "text-right")}>Valor</th>
                    <th className={cn(thClass, "text-right")}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {extratoLinhas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={cn(tdClass, "py-10 text-center text-[#9ca3af]")}>
                        Nenhuma movimentação encontrada para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    extratoLinhas.map(({ lancamento: l, saldo }, index) => (
                      <tr
                        key={l.id}
                        className={cn(
                          index % 2 === 0 ? "bg-white" : "bg-[#f8fafc]",
                          "hover:brightness-[0.98]"
                        )}
                      >
                        <td className={tdClass}>{formatDate(l.data)}</td>
                        <td className={tdClass}>{referenciaLancamento(l)}</td>
                        <td className={tdClass}>
                          <span className="font-medium text-[#2563eb]">
                            {l.formaPagamento || "—"}
                          </span>
                        </td>
                        <td className={cn(tdClass, "text-right tabular-nums")}>
                          {money(l.valor)}
                        </td>
                        <td
                          className={cn(
                            tdClass,
                            "text-right font-semibold tabular-nums",
                            saldo > 0.009 ? "text-[#16a34a]" : saldo < -0.009 ? "text-[#dc2626]" : ""
                          )}
                        >
                          {money(saldo)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {aba === "recebimentos" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className={thFaturasClass}>Data Recebimento</th>
                    <th className={thFaturasClass}>Forma Pagamento</th>
                    <th className={cn(thFaturasClass, "text-right")}>Valor</th>
                    <th className={thFaturasClass}>Observação</th>
                    <th className={cn(thFaturasClass, "text-right")}>Opções</th>
                  </tr>
                </thead>
                <tbody>
                  {recebimentosVisiveis.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className={cn(tdFaturasClass, "py-12 text-center text-[#9ca3af]")}
                      >
                        Nenhum recebimento encontrado para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    recebimentosVisiveis.map((l) => (
                      <tr key={l.id} className="bg-white hover:bg-[#fafafa]">
                        <td className={tdFaturasClass}>{formatDate(l.data)}</td>
                        <td className={tdFaturasClass}>
                          <span className="cursor-pointer font-medium text-[#2563eb] hover:underline">
                            {l.formaPagamento || "—"}
                          </span>
                        </td>
                        <td className={cn(tdFaturasClass, "text-right tabular-nums")}>
                          {money(l.valor)}
                        </td>
                        <td className={cn(tdFaturasClass, "max-w-[16rem] truncate text-[#6b7280]")}>
                          {observacaoRecebimento(l.descricao)}
                        </td>
                        <td className={cn(tdFaturasClass, "text-right")}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Imprimir recibo"
                              onClick={() => onImprimirRecibo(l)}
                              className="inline-flex items-center gap-1 rounded bg-[#4a90d9] px-2.5 py-1 text-[10px] font-medium text-white hover:bg-[#3d7fc4]"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Recibo
                            </button>
                            <button
                              type="button"
                              title="Visualizar"
                              onClick={() => onDetalheRecebimento(l)}
                              className={cn(btnOpcaoClass, "text-[#4a90d9]")}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Editar"
                              onClick={() => onDetalheRecebimento(l)}
                              className={cn(btnOpcaoClass, "text-[#6b7280]")}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Excluir"
                              onClick={() => onEstornarRecebimento(l)}
                              className={cn(btnOpcaoClass, "text-[#dc2626]")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
