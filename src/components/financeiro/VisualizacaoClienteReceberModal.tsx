"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CircleDollarSign, Eye, Pencil, Printer, Trash2, X } from "lucide-react";
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
  "border border-[#c5c9cf] bg-[#eceff3] px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#374151] whitespace-nowrap";
const tdClass = "border border-[#d1d5db] px-2 py-1.5 text-[11px] text-[#374151]";
const btnOpcaoClass =
  "inline-flex h-6 w-6 items-center justify-center rounded-sm transition hover:bg-[#f3f4f6]";

function parcelaLabel(descricao: string) {
  const p = parseParcelaNaDescricao(descricao);
  if (!p) return "1/1";
  return `${p.numero}/${p.total}`;
}

function observacaoLinha(descricao: string) {
  if (!descricao.toLowerCase().startsWith("cobrança os")) return "";
  const partes = descricao.replace(/@@trab:[a-zA-Z0-9_,-]+@@/g, "").split(" - ");
  return partes.slice(1).join(" - ").replace(/\(\d+\s*\/\s*\d+\)\s*$/, "").trim();
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

function dataSomente(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(iso);
  date.setHours(0, 0, 0, 0);
  return date;
}

function faturaEmAberto(
  l: LancamentoClienteModal,
  saldoFatura: (l: LancamentoClienteModal) => number
) {
  return l.status !== "pago" && saldoFatura(l) > 0.009;
}

function fundoLinhaFatura(
  l: LancamentoClienteModal,
  index: number,
  saldoFatura: (l: LancamentoClienteModal) => number
) {
  if (!faturaEmAberto(l, saldoFatura)) {
    return index % 2 === 0 ? "bg-white" : "bg-[#f8fafc]";
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (dataSomente(l.data) < hoje) return "bg-[#fecaca]/55";
  return "bg-[#bbf7d0]/45";
}

function badgeSituacaoFatura(
  l: LancamentoClienteModal,
  situacaoFaturaLabel: (l: LancamentoClienteModal) => { label: string; aReceber: boolean }
) {
  const sit = situacaoFaturaLabel(l);
  if (sit.aReceber) {
    return (
      <span className="inline-block min-w-[5.5rem] rounded-sm bg-[#4a90d9] px-2 py-0.5 text-center text-[10px] font-bold uppercase text-white">
        A RECEBER
      </span>
    );
  }
  const label = sit.label.toUpperCase();
  if (label.includes("VENCID")) {
    return (
      <span className="inline-block min-w-[5.5rem] rounded-sm bg-[#dc2626] px-2 py-0.5 text-center text-[10px] font-bold uppercase text-white">
        VENCIDO
      </span>
    );
  }
  if (label.includes("RECEB")) {
    return (
      <span className="inline-block min-w-[5.5rem] rounded-sm bg-[#16a34a] px-2 py-0.5 text-center text-[10px] font-bold uppercase text-white">
        RECEBIDO
      </span>
    );
  }
  if (label.includes("CANCEL")) {
    return (
      <span className="inline-block min-w-[5.5rem] rounded-sm bg-[#9ca3af] px-2 py-0.5 text-center text-[10px] font-bold uppercase text-white">
        CANCELADO
      </span>
    );
  }
  return (
    <span className="inline-block min-w-[5.5rem] rounded-sm bg-[#9ca3af] px-2 py-0.5 text-center text-[10px] font-bold uppercase text-white">
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
  const [aba, setAba] = useState<"faturas" | "recebimentos" | "faturar">("faturas");
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

  const totalValorFaturas = faturasVisiveis.reduce((s, l) => s + l.valor, 0);
  const totalRecebidoFaturas = faturasVisiveis.reduce((s, l) => s + recebidoNaFatura(l), 0);
  const totalSaldoFaturas = faturasVisiveis.reduce((s, l) => s + saldoFatura(l), 0);

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

        <div className="flex shrink-0 border-b border-[#e5e7eb]">
          {(
            [
              ["faturas", "Faturas"],
              ["recebimentos", "Recebimentos"],
              ["faturar", "Faturar"],
            ] as const
          ).map(([id, titulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={cn(
                "min-w-[7.5rem] border-r border-[#e5e7eb] px-6 py-2 text-[13px] font-medium transition last:border-r-0",
                aba === id
                  ? "bg-[#4a90d9] text-white"
                  : "bg-[#f9fafb] text-[#6b7280] hover:bg-[#f3f4f6]"
              )}
            >
              {titulo}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-[#e5e7eb] bg-white px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[220px] rounded-sm border border-[#bfdbfe] bg-[#f8fbff] px-3 py-2">
              <p className="text-[10px] leading-tight text-[#6b7280]">
                Total a Receber (Lançamentos Fixos: {money(adiantamentosCliente)})
              </p>
              <p className="text-[20px] font-bold leading-tight text-[#2563eb]">
                R$ {money(totalLinhaAReceber)}
              </p>
            </div>
            <div className="min-w-[220px] rounded-sm border border-[#86efac] bg-[#f7fef9] px-3 py-2">
              <p className="text-[10px] leading-tight text-[#6b7280]">
                A Receber Faturas {mesLabel} {ano}
              </p>
              <p className="text-[20px] font-bold leading-tight text-[#16a34a]">
                R$ {money(totalAReceber)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Procurar"
              className="h-[30px] w-[10.5rem] rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
            />
            <button
              type="button"
              onClick={() => setBusca("")}
              className="h-[30px] rounded-sm border border-[#d1d5db] bg-[#f3f4f6] px-3 text-[12px] text-[#374151] hover:bg-[#e5e7eb]"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={onReceber}
              className="h-[30px] rounded-sm bg-[#4a90d9] px-4 text-[12px] font-medium text-white hover:bg-[#3d7fc4]"
            >
              Receber
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[#fafafa] px-4 py-3">
          {(aba === "faturas" || aba === "faturar") && (
            <div className="overflow-x-auto border border-[#c5c9cf] bg-white">
              {aba === "faturar" && (
                <div className="flex items-center justify-between border-b border-[#d1d5db] bg-[#f3f4f6] px-3 py-2">
                  <span className="text-[12px] font-medium text-[#374151]">
                    Nota de cobrança do cliente
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
              )}
              <table className="w-full min-w-[980px] border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className={thClass}>Vencimento</th>
                    <th className={cn(thClass, "text-center")}>Fatura</th>
                    <th className={cn(thClass, "text-center")}>Parc.</th>
                    <th className={thClass}>Forma</th>
                    <th className={thClass}>Observação</th>
                    <th className={cn(thClass, "text-right")}>Valor</th>
                    <th className={cn(thClass, "text-right")}>Recebido</th>
                    <th className={cn(thClass, "text-right")}>Saldo</th>
                    <th className={cn(thClass, "text-center")}>Situação</th>
                    <th className={cn(thClass, "text-center")}>Opções</th>
                  </tr>
                </thead>
                <tbody>
                  {faturasVisiveis.length === 0 ? (
                    <tr>
                      <td colSpan={10} className={cn(tdClass, "py-10 text-center text-[#9ca3af]")}>
                        Nenhuma fatura encontrada para o período e filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    faturasVisiveis.map((l, index) => {
                      const saldo = saldoFatura(l);
                      const emAberto = faturaEmAberto(l, saldoFatura);
                      const boletoUrl =
                        l.cobrancaAsaas?.bankSlipUrl || l.cobrancaAsaas?.invoiceUrl;
                      return (
                        <tr
                          key={l.id}
                          className={cn(
                            fundoLinhaFatura(l, index, saldoFatura),
                            "hover:brightness-[0.98]"
                          )}
                        >
                          <td className={tdClass}>{formatDate(l.data)}</td>
                          <td className={cn(tdClass, "text-center")}>{numeroFatura(l)}</td>
                          <td className={cn(tdClass, "text-center")}>
                            {parcelaLabel(l.descricao)}
                          </td>
                          <td className={tdClass}>
                            {boletoUrl ? (
                              <a
                                href={boletoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-[#2563eb] hover:underline"
                              >
                                {l.formaPagamento || "—"}
                              </a>
                            ) : (
                              <span className="font-medium text-[#2563eb]">
                                {l.formaPagamento || "—"}
                              </span>
                            )}
                          </td>
                          <td className={cn(tdClass, "max-w-[12rem] truncate")}>
                            {observacaoLinha(l.descricao)}
                          </td>
                          <td className={cn(tdClass, "text-right tabular-nums")}>
                            {money(l.valor)}
                          </td>
                          <td className={cn(tdClass, "text-right tabular-nums")}>
                            {money(recebidoNaFatura(l))}
                          </td>
                          <td
                            className={cn(
                              tdClass,
                              "text-right font-semibold tabular-nums",
                              saldo > 0.009 ? "text-[#16a34a]" : "text-[#374151]"
                            )}
                          >
                            {money(saldo)}
                          </td>
                          <td className={cn(tdClass, "text-center")}>
                            {badgeSituacaoFatura(l, situacaoFaturaLabel)}
                          </td>
                          <td className={cn(tdClass, "text-center")}>
                            <div className="flex items-center justify-center gap-0">
                              <button
                                type="button"
                                title="Visualizar"
                                onClick={() => onVisualizarFatura(l)}
                                className={cn(btnOpcaoClass, "text-[#4a90d9]")}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Editar"
                                onClick={() => onEditarFatura(l)}
                                className={cn(btnOpcaoClass, "text-[#6b7280]")}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Excluir"
                                onClick={() => onExcluirFatura(l)}
                                className={cn(btnOpcaoClass, "text-[#dc2626]")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              {emAberto ? (
                                <button
                                  type="button"
                                  title="Lançar recebimento"
                                  onClick={() =>
                                    onReceberFatura ? onReceberFatura(l) : onReceber()
                                  }
                                  className={cn(btnOpcaoClass, "text-[#4a90d9]")}
                                >
                                  <CircleDollarSign className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Imprimir nota"
                                  onClick={() => onImprimirFatura(l)}
                                  className={cn(btnOpcaoClass, "text-[#4a90d9]")}
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {faturasVisiveis.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#eceff3] font-bold">
                      <td
                        className={cn(tdClass, "text-right text-[10px] uppercase tracking-wide")}
                        colSpan={5}
                      >
                        Totais
                      </td>
                      <td className={cn(tdClass, "text-right tabular-nums")}>
                        {money(totalValorFaturas)}
                      </td>
                      <td className={cn(tdClass, "text-right tabular-nums")}>
                        {money(totalRecebidoFaturas)}
                      </td>
                      <td className={cn(tdClass, "text-right tabular-nums text-[#16a34a]")}>
                        {money(totalSaldoFaturas)}
                      </td>
                      <td className={tdClass} colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {aba === "recebimentos" && (
            <div className="overflow-x-auto border border-[#c5c9cf] bg-white">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    <th className={thClass}>Data</th>
                    <th className={thClass}>Forma Pagamento</th>
                    <th className={thClass}>Referência</th>
                    <th className={cn(thClass, "text-right")}>Valor</th>
                    <th className={cn(thClass, "text-center")}>Opções</th>
                  </tr>
                </thead>
                <tbody>
                  {recebimentosVisiveis.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={cn(tdClass, "py-10 text-center text-[#9ca3af]")}>
                        Nenhum recebimento encontrado para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    recebimentosVisiveis.map((l, index) => (
                      <tr
                        key={l.id}
                        className={cn(
                          index % 2 === 0 ? "bg-white" : "bg-[#f8fafc]",
                          "hover:brightness-[0.98]"
                        )}
                      >
                        <td className={tdClass}>{formatDate(l.data)}</td>
                        <td className={tdClass}>
                          <span className="font-medium text-[#2563eb]">
                            {l.formaPagamento || "—"}
                          </span>
                        </td>
                        <td className={tdClass}>{referenciaLancamento(l)}</td>
                        <td className={cn(tdClass, "text-right tabular-nums")}>
                          {money(l.valor)}
                        </td>
                        <td className={cn(tdClass, "text-center")}>
                          <div className="flex items-center justify-center gap-0">
                            <button
                              type="button"
                              title="Detalhes"
                              onClick={() => onDetalheRecebimento(l)}
                              className={cn(btnOpcaoClass, "text-[#4a90d9]")}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Imprimir recibo"
                              onClick={() => onImprimirRecibo(l)}
                              className={cn(btnOpcaoClass, "text-[#4a90d9]")}
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Estornar"
                              onClick={() => onEstornarRecebimento(l)}
                              className={cn(btnOpcaoClass, "text-[#dc2626]")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
