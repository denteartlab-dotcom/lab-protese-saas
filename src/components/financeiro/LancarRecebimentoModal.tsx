"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Pencil, Plus, X } from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { dateToBrShort } from "@/lib/datas-br";
import { parseParcelaNaDescricao } from "@/lib/fatura-financeiro-util";
import { cn } from "@/lib/utils";

export type LancamentoRecebimento = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome: string } | null;
  trabalho?: { id: string; numeroOs: number } | null;
};

export type FormaRecebimentoEntrada = {
  id: string;
  forma: string;
  conta: string;
  valor: string;
  observacao: string;
};

export type LancarRecebimentoConfirmacao = {
  faturasSelecionadas: string[];
  jurosPorFatura: Record<string, number>;
  formas: FormaRecebimentoEntrada[];
  dataRecebimento: string;
  emitirNotaFiscal: boolean;
  abaterCredito?: boolean;
};

type FaturaLinha = {
  id: string;
  numeroFatura: number;
  parcela: string;
  vencimento: string;
  formaRecebimento: string;
  valor: number;
  saldo: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  clienteNome: string;
  totalDevido: number;
  faturas: LancamentoRecebimento[];
  numeroFatura: (lancamento: LancamentoRecebimento) => number;
  saldoFatura: (lancamento: LancamentoRecebimento) => number;
  formatDate: (iso: string) => string;
  money: (value: number) => string;
  parseMoney: (value: string) => number;
  formatCurrencyInput: (value: string) => string;
  onConfirmar: (payload: LancarRecebimentoConfirmacao, imprimir: boolean) => void;
  onVisualizar: (lancamento: LancamentoRecebimento) => void;
  emitirNotaFiscalPadrao?: boolean;
  creditoDisponivel?: number;
  pixAsaasDisponivel?: boolean;
};

const FORMAS_BASE = ["Pix Externo", "Dinheiro", "Cartão", "Boleto", "Transferência"];
const CONTAS_BASE = ["Caixa Principal", "Banco"];

const thClass =
  "border border-[#d1d5db] bg-[#f3f4f6] px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-[#4b5563]";
const tdClass = "border border-[#e5e7eb] px-2 py-2 text-[11px] text-[#374151]";
const fieldClass =
  "h-[32px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

function parcelaLabel(descricao: string) {
  const p = parseParcelaNaDescricao(descricao);
  if (!p) return "1/1";
  return `${p.numero}/${p.total}`;
}

function ToggleSmart({
  checked,
  onChange,
  label,
  labelClassName,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  labelClassName?: string;
}) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2", labelClassName)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition",
          checked ? "bg-[#4a90d9]" : "bg-[#cbd5e1]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
            checked ? "left-[18px]" : "left-0.5"
          )}
        />
      </button>
      {label ? <span className="text-[12px] text-[#374151]">{label}</span> : null}
    </label>
  );
}

function novaFormaEntrada(): FormaRecebimentoEntrada {
  return {
    id: `forma-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    forma: "Pix Externo",
    conta: "Caixa Principal",
    valor: "R$ 0,00",
    observacao: "",
  };
}

export function LancarRecebimentoModal({
  open,
  onClose,
  clienteNome,
  totalDevido,
  faturas,
  numeroFatura,
  saldoFatura,
  formatDate,
  money,
  parseMoney,
  formatCurrencyInput,
  onConfirmar,
  onVisualizar,
  emitirNotaFiscalPadrao = false,
  creditoDisponivel = 0,
  pixAsaasDisponivel = false,
}: Props) {
  const formasDisponiveis = useMemo(
    () => (pixAsaasDisponivel ? ["Pix", ...FORMAS_BASE] : FORMAS_BASE),
    [pixAsaasDisponivel]
  );
  const contasDisponiveis = useMemo(
    () =>
      pixAsaasDisponivel
        ? ["Caixa Principal", "Conta Bancária", "Banco"]
        : CONTAS_BASE,
    [pixAsaasDisponivel]
  );
  const [mounted, setMounted] = useState(false);
  const [selecaoAutomatica, setSelecaoAutomatica] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [jurosPorFatura, setJurosPorFatura] = useState<Record<string, number>>({});
  const [jurosEditando, setJurosEditando] = useState<string | null>(null);
  const [formas, setFormas] = useState<FormaRecebimentoEntrada[]>([]);
  const [dataRecebimento, setDataRecebimento] = useState(dateToBrShort(new Date()));
  const [emitirNotaFiscal, setEmitirNotaFiscal] = useState(emitirNotaFiscalPadrao);
  const [abaterCredito, setAbaterCredito] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const linhas = useMemo<FaturaLinha[]>(
    () =>
      faturas.map((l) => ({
        id: l.id,
        numeroFatura: numeroFatura(l),
        parcela: parcelaLabel(l.descricao),
        vencimento: formatDate(l.data),
        formaRecebimento: l.formaPagamento || "Pix Externo",
        valor: l.valor,
        saldo: saldoFatura(l),
      })),
    [faturas, formatDate, numeroFatura, saldoFatura]
  );

  const modoSomenteAdiantamento = linhas.length === 0;

  useEffect(() => {
    if (!open) return;
    setSelecaoAutomatica(false);
    setSelecionadas([]);
    setJurosPorFatura({});
    setJurosEditando(null);
    setFormas([{ ...novaFormaEntrada(), valor: formatCurrencyInput("0") }]);
    setDataRecebimento(dateToBrShort(new Date()));
    setEmitirNotaFiscal(emitirNotaFiscalPadrao);
    setAbaterCredito(false);
  }, [open, emitirNotaFiscalPadrao, formatCurrencyInput]);

  const valorComJuros = (id: string, saldo: number) => saldo + (jurosPorFatura[id] ?? 0);

  const valorSelecionado = useMemo(
    () =>
      linhas
        .filter((l) => selecionadas.includes(l.id))
        .reduce((s, l) => s + valorComJuros(l.id, l.saldo), 0),
    [linhas, selecionadas, jurosPorFatura]
  );

  const valorCreditoAbater = useMemo(() => {
    if (!abaterCredito || creditoDisponivel <= 0) return 0;
    return Math.min(creditoDisponivel, valorSelecionado);
  }, [abaterCredito, creditoDisponivel, valorSelecionado]);

  const valorDinheiroSugerido = Math.max(0, valorSelecionado - valorCreditoAbater);

  useEffect(() => {
    if (!open || modoSomenteAdiantamento || selecionadas.length === 0) return;
    const valorFmt = formatCurrencyInput(String(Math.round(valorDinheiroSugerido * 100)));
    setFormas((atual) => {
      if (atual.length === 0) {
        return [{ ...novaFormaEntrada(), valor: valorFmt }];
      }
      const copia = [...atual];
      copia[0] = { ...copia[0], valor: valorFmt };
      return copia;
    });
  }, [open, modoSomenteAdiantamento, selecionadas.length, valorDinheiroSugerido, formatCurrencyInput]);

  const totalReceber = useMemo(
    () => formas.reduce((s, f) => s + parseMoney(f.valor), 0),
    [formas, parseMoney]
  );

  const totalAplicadoRecebimento = totalReceber + valorCreditoAbater;

  const saldoRestanteAposRecebimento = useMemo(() => {
    if (selecionadas.length === 0 || valorSelecionado <= 0.009) return 0;
    return Math.max(0, valorSelecionado - totalAplicadoRecebimento);
  }, [selecionadas.length, valorSelecionado, totalAplicadoRecebimento]);

  const recebimentoParcial = useMemo(
    () =>
      selecionadas.length > 0 &&
      valorSelecionado > 0.009 &&
      totalAplicadoRecebimento > 0.009 &&
      saldoRestanteAposRecebimento > 0.02,
    [selecionadas.length, valorSelecionado, totalAplicadoRecebimento, saldoRestanteAposRecebimento]
  );

  const valorLancamentoCredito = useMemo(() => {
    if (selecionadas.length === 0 || valorSelecionado <= 0.009) return 0;
    const totalAplicado = totalReceber + valorCreditoAbater;
    return Math.max(0, totalAplicado - valorSelecionado);
  }, [selecionadas.length, valorSelecionado, totalReceber, valorCreditoAbater]);

  function aplicarSelecaoAutomatica(ativa: boolean) {
    setSelecaoAutomatica(ativa);
    if (ativa) {
      setSelecionadas(linhas.map((l) => l.id));
    }
  }

  function toggleFatura(id: string) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );
  }

  function atualizarJuros(id: string, valor: string) {
    const num = parseMoney(valor);
    setJurosPorFatura((atual) => ({ ...atual, [id]: num }));
  }

  function adicionarForma() {
    setFormas((atual) => [...atual, novaFormaEntrada()]);
  }

  function atualizarForma(id: string, patch: Partial<FormaRecebimentoEntrada>) {
    setFormas((atual) => atual.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removerForma(id: string) {
    setFormas((atual) => atual.filter((f) => f.id !== id));
  }

  function confirmar(imprimir: boolean) {
    onConfirmar(
      {
        faturasSelecionadas: selecionadas,
        jurosPorFatura,
        formas,
        dataRecebimento,
        emitirNotaFiscal,
        abaterCredito: abaterCredito && valorCreditoAbater > 0,
      },
      imprimir
    );
  }

  const podeConfirmar = useMemo(() => {
    if (selecionadas.length === 0) {
      return totalReceber > 0.009;
    }
    return valorSelecionado > 0.009 && totalAplicadoRecebimento > 0.009;
  }, [selecionadas.length, totalReceber, valorSelecionado, totalAplicadoRecebimento]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lancar-recebimento-titulo"
        className="relative flex max-h-[94vh] w-full max-w-[1120px] flex-col rounded-sm bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
          <h2 id="lancar-recebimento-titulo" className="text-[15px] font-medium text-[#374151]">
            {modoSomenteAdiantamento ? "Lançar Adiantamento / Crédito" : "Lançar Recebimento"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#6b7280]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {modoSomenteAdiantamento ? (
            <div className="mb-4 rounded-sm border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[12px] text-[#166534]">
              Este cliente não tem fatura pendente. Informe o valor recebido abaixo para gerar
              crédito de adiantamento (saldo em haver).
            </div>
          ) : null}
          <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] text-[#374151]">
            <p>
              Cliente: <strong>{clienteNome}</strong>
            </p>
            <p className="ml-auto">
              Total Devido:{" "}
              <strong className="text-[#dc2626]">{money(totalDevido)}</strong>
            </p>
            {!modoSomenteAdiantamento ? (
              <ToggleSmart
                checked={selecaoAutomatica}
                onChange={aplicarSelecaoAutomatica}
                label="Seleção Automática"
              />
            ) : null}
          </div>

          <div className="overflow-x-auto border border-[#d1d5db]">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Nº Fatura</th>
                  <th className={thClass}>Parcela</th>
                  <th className={thClass}>Vencimento</th>
                  <th className={thClass}>Forma Recebimento</th>
                  <th className={cn(thClass, "text-right")}>Valor</th>
                  <th className={cn(thClass, "text-right")}>Juros</th>
                  <th className={cn(thClass, "text-center")}>Visualizar</th>
                  <th className={cn(thClass, "text-center text-[#16a34a]")}>
                    Selecionar Fatura
                  </th>
                </tr>
              </thead>
              <tbody className={cn(linhas.length === 0 && "min-h-[40px]")}>
                {linhas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-[12px] text-[#6b7280]"
                    >
                      Nenhuma fatura pendente. Informe o valor abaixo para lançar adiantamento
                      (crédito do cliente).
                    </td>
                  </tr>
                ) : null}
                {linhas.map((linha) => {
                    const juros = jurosPorFatura[linha.id] ?? 0;
                    const editandoJuros = jurosEditando === linha.id;
                    return (
                      <tr key={linha.id} className="bg-white">
                        <td className={tdClass}>{linha.numeroFatura}</td>
                        <td className={tdClass}>{linha.parcela}</td>
                        <td className={tdClass}>{linha.vencimento}</td>
                        <td className={tdClass}>{linha.formaRecebimento}</td>
                        <td className={cn(tdClass, "text-right")}>{money(linha.saldo)}</td>
                        <td className={cn(tdClass, "text-right")}>
                          <div className="flex items-center justify-end gap-1">
                            {editandoJuros ? (
                              <input
                                type="text"
                                autoFocus
                                defaultValue={money(juros)}
                                onBlur={(e) => {
                                  atualizarJuros(linha.id, e.target.value);
                                  setJurosEditando(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    atualizarJuros(linha.id, e.currentTarget.value);
                                    setJurosEditando(null);
                                  }
                                }}
                                className="h-7 w-20 rounded-sm border border-[#d1d5db] px-1 text-right text-[11px] outline-none focus:border-[#4a90d9]"
                              />
                            ) : (
                              <span>{money(juros)}</span>
                            )}
                            <button
                              type="button"
                              title="Editar juros"
                              onClick={() => setJurosEditando(linha.id)}
                              className="text-[#4a90d9] hover:text-[#3d7fc4]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className={cn(tdClass, "text-center")}>
                          <button
                            type="button"
                            title="Visualizar fatura"
                            onClick={() => {
                              const lanc = faturas.find((f) => f.id === linha.id);
                              if (lanc) onVisualizar(lanc);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#d1d5db] text-[#6b7280] hover:bg-[#f9fafb]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        <td className={cn(tdClass, "text-center")}>
                          <div className="flex justify-center">
                            <ToggleSmart
                              checked={selecionadas.includes(linha.id)}
                              onChange={() => toggleFatura(linha.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            <div className="flex justify-end border-t border-[#e5e7eb] bg-white px-3 py-2">
              <p className="text-[12px] font-medium text-[#4a90d9]">
                Valor Selecionado {money(valorSelecionado)}
              </p>
            </div>
          </div>

          <div className="mt-4 border border-[#d1d5db]">
            <div className="flex flex-wrap items-center gap-4 border-b border-[#e5e7eb] px-3 py-2.5">
              <strong className="text-[12px] text-[#374151]">Lançar Recebimento</strong>
              {creditoDisponivel > 0.009 && linhas.length > 0 ? (
                <ToggleSmart
                  checked={abaterCredito}
                  onChange={setAbaterCredito}
                  label={`Abater do Crédito de ${money(creditoDisponivel)}`}
                />
              ) : creditoDisponivel > 0.009 ? (
                <span className="text-[12px] text-[#16a34a]">
                  Crédito disponível: {money(creditoDisponivel)}
                </span>
              ) : null}
              {!modoSomenteAdiantamento ? (
                <ToggleSmart
                  checked={emitirNotaFiscal}
                  onChange={setEmitirNotaFiscal}
                  label="Emitir Nota Fiscal"
                  labelClassName="mx-auto"
                />
              ) : null}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] text-[#6b7280]">Data Recebimento</span>
                <CampoDataBr
                  value={dataRecebimento}
                  onChange={setDataRecebimento}
                  iconPosition="left"
                  className="h-[32px] w-[9.5rem] space-y-0 [&>div]:h-full"
                  inputClassName="h-[32px] rounded-sm border border-[#d1d5db] py-0 pl-8 pr-2 text-[12px] shadow-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-0 border-b border-[#e5e7eb] bg-[#f9fafb] px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">
              <span className="px-1">Forma Recebimento</span>
              <span className="px-1">Conta</span>
              <span className="px-1 text-[#16a34a]">Digite o Valor Recebido</span>
              <span className="px-1">Observação</span>
            </div>

            <div className="space-y-0">
              {formas.map((forma) => (
                <div
                  key={forma.id}
                  className="grid grid-cols-4 gap-2 border-b border-[#f3f4f6] px-2 py-2"
                >
                  <select
                    value={forma.forma}
                    onChange={(e) => atualizarForma(forma.id, { forma: e.target.value })}
                    className={fieldClass}
                  >
                    {formasDisponiveis.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <select
                    value={forma.conta}
                    onChange={(e) => atualizarForma(forma.id, { conta: e.target.value })}
                    className={fieldClass}
                  >
                    {contasDisponiveis.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={forma.valor}
                    onChange={(e) =>
                      atualizarForma(forma.id, {
                        valor: formatCurrencyInput(e.target.value),
                      })
                    }
                    className={cn(fieldClass, "text-right")}
                    placeholder="R$ 0,00"
                  />
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={forma.observacao}
                      onChange={(e) =>
                        atualizarForma(forma.id, { observacao: e.target.value })
                      }
                      className={fieldClass}
                      placeholder=""
                    />
                    {formas.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removerForma(forma.id)}
                        className="shrink-0 px-2 text-[#9ca3af] hover:text-[#dc2626]"
                        aria-label="Remover forma"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {valorLancamentoCredito > 0.009 ? (
              <p className="px-3 py-2 text-[12px] font-medium text-[#ea580c]">
                Lançamento de Crédito {money(valorLancamentoCredito)} (O beneficiário terá saldo em
                haver)
              </p>
            ) : null}

            {recebimentoParcial ? (
              <p className="px-3 py-2 text-[12px] font-medium text-[#ea580c]">
                Recebimento parcial — saldo restante da fatura: {money(saldoRestanteAposRecebimento)}
              </p>
            ) : null}

            <div className="px-3 py-2.5">
              <button
                type="button"
                onClick={adicionarForma}
                className="inline-flex items-center gap-1.5 rounded-sm border border-[#4a90d9] bg-white px-3 py-1.5 text-[12px] text-[#4a90d9] hover:bg-[#eff6ff]"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar Forma de Recebimento
              </button>
            </div>

            <div className="flex flex-wrap justify-end gap-4 border-t border-[#e5e7eb] px-3 py-2">
              {valorCreditoAbater > 0 ? (
                <p className="text-[12px] font-medium text-[#dc2626]">
                  Crédito a abater {money(valorCreditoAbater)}
                </p>
              ) : null}
              <p className="text-[12px] font-medium text-[#16a34a]">
                Total Receber {money(totalReceber)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-3 border-t border-[#e5e7eb] px-5 py-4">
          <button
            type="button"
            onClick={() => confirmar(false)}
            disabled={!podeConfirmar}
            className="h-11 rounded-sm bg-[#4a90d9] text-sm font-normal text-white hover:bg-[#3d7fc4] disabled:opacity-50"
          >
            {modoSomenteAdiantamento ? "Confirmar Adiantamento" : "Confirmar Recebimento"}
          </button>
          <button
            type="button"
            onClick={() => confirmar(true)}
            disabled={!podeConfirmar}
            className="h-11 rounded-sm bg-[#22c55e] text-sm font-normal text-white hover:bg-[#16a34a] disabled:opacity-50"
          >
            {modoSomenteAdiantamento
              ? "Confirmar Adiantamento e Imprimir Recibo"
              : "Confirmar Recebimento e Imprimir Recibo"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-sm border border-[#9ca3af] bg-white text-sm font-normal text-[#374151] hover:bg-[#f9fafb]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
