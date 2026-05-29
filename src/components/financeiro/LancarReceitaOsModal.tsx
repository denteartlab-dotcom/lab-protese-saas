"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Barcode, Minus, Plus, X } from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { PlanoContasCategoriaSelect } from "@/components/financeiro/PlanoContasCategoriaSelect";
import { SituacaoOsBadgeReceita } from "@/components/financeiro/SituacaoOsBadgeReceita";
import { dateToBrShort } from "@/lib/datas-br";
import {
  carregarPlanoContas,
  categoriaPadraoLancamento,
  contasAnaliticasPlano,
  PLANO_CONTAS_ATUALIZADO_EVENT,
} from "@/lib/plano-contas";
import { cn, STATUS_TRABALHO } from "@/lib/utils";
import type { TrabalhoSituacaoBadge } from "@/components/financeiro/SituacaoOsBadgeReceita";

export type LancarReceitaOsForm = {
  tipo: string;
  semOs: boolean;
  clienteId: string;
  convenio: string;
  categoria: string;
  descricao: string;
  valor: string;
  descontoTipo: string;
  desconto: string;
  jurosTipo: string;
  juros: string;
  acrescimo: boolean;
  data: string;
  pedidoInicio: string;
  pedidoFinal: string;
  situacaoOs: string;
  vencimento: string;
  status: string;
  formaPagamento: string;
  conta: string;
  parcela: string;
  observacoes: string;
  recebido: boolean;
};

type TrabalhoReceita = TrabalhoSituacaoBadge & {
  cliente?: { nome?: string | null } | null;
  paciente?: { nome?: string | null } | null;
};

export type ParcelaLinhaReceita = {
  parcela: string;
  formaPagamento: string;
  conta: string;
  vencimento: string;
  valor: string;
  valorTipo: "percentual" | "valor";
  juros: string;
  jurosTipo: "percentual" | "valor";
  recebido: boolean;
};

export type LancarReceitaOsSubmit = {
  form: LancarReceitaOsForm;
  parcelas: ParcelaLinhaReceita[];
  imprimirRecibo: boolean;
  alterarEntregue: boolean;
};

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280]";
const fieldClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2.5 text-[13px] text-[#374151] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (dados: LancarReceitaOsSubmit) => void | Promise<void>;
  form: LancarReceitaOsForm;
  setForm: React.Dispatch<React.SetStateAction<LancarReceitaOsForm>>;
  clientes: { id: string; nome: string }[];
  trabalhosParaReceita: TrabalhoReceita[];
  osSelecionadas: string[];
  toggleOsReceita: (id: string) => void;
  toggleSelecionarTodasReceita: () => void;
  todasReceitaSelecionadas: boolean;
  algumasReceitaSelecionadas: boolean;
  valorOsSelecionadas: number;
  totalLiquido: number;
  creditoAplicado: number;
  totalAReceberComCredito: number;
  mensagemLancamento: string;
  mensagemLancamentoTipo: "erro" | "sucesso";
  formaSelecionadaEhBoleto: () => boolean;
  valorTrabalho: (trabalho: TrabalhoReceita) => number;
  onLimparOsSelecionadas: () => void;
  money: (value: number) => string;
  currency: (value: number) => string;
  formatDecimalInput: (value: string) => string;
  formatCurrencyInput: (value: string) => string;
};

function CampoMoedaOuPercentual({
  tipo,
  valor,
  onTipoChange,
  onValorChange,
  formatDecimalInput,
  formatCurrencyInput,
  className,
}: {
  tipo: "percentual" | "valor";
  valor: string;
  onTipoChange: (tipo: "percentual" | "valor") => void;
  onValorChange: (valor: string) => void;
  formatDecimalInput: (value: string) => string;
  formatCurrencyInput: (value: string) => string;
  className?: string;
}) {
  return (
    <div className={cn("flex overflow-hidden rounded-sm border border-[#d1d5db]", className)}>
      <select
        value={tipo}
        onChange={(e) =>
          onTipoChange(e.target.value === "valor" ? "valor" : "percentual")
        }
        className="h-8 w-11 shrink-0 border-r border-[#d1d5db] bg-white text-center text-[11px] outline-none"
      >
        <option value="percentual">%</option>
        <option value="valor">R$</option>
      </select>
      <input
        type="text"
        value={valor}
        onChange={(e) =>
          onValorChange(
            tipo === "valor"
              ? formatCurrencyInput(e.target.value)
              : formatDecimalInput(e.target.value)
          )
        }
        className="h-8 min-w-0 flex-1 border-0 bg-white px-2 text-right text-[12px] outline-none"
      />
    </div>
  );
}

function ToggleSmart({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-[#374151]">
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
      {label}
    </label>
  );
}

export function LancarReceitaOsModal({
  open,
  onClose,
  onSubmit,
  form,
  setForm,
  clientes,
  trabalhosParaReceita,
  osSelecionadas,
  toggleOsReceita,
  toggleSelecionarTodasReceita,
  todasReceitaSelecionadas,
  algumasReceitaSelecionadas,
  valorOsSelecionadas,
  totalLiquido,
  creditoAplicado,
  totalAReceberComCredito,
  mensagemLancamento,
  mensagemLancamentoTipo,
  formaSelecionadaEhBoleto,
  valorTrabalho,
  onLimparOsSelecionadas,
  money,
  currency,
  formatDecimalInput,
  formatCurrencyInput,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [alterarEntregue, setAlterarEntregue] = useState(true);
  const [enviarControleEntrega, setEnviarControleEntrega] = useState(false);
  const [codigoBarras, setCodigoBarras] = useState("");
  const [numParcelas, setNumParcelas] = useState(1);
  const [imprimirRecibo, setImprimirRecibo] = useState(false);
  const [parcelas, setParcelas] = useState<ParcelaLinhaReceita[]>([
    {
      parcela: "1/1",
      formaPagamento: "Forma Pagamento",
      conta: "Caixa Principal",
      vencimento: dateToBrShort(new Date()),
      valor: "0,00",
      valorTipo: "valor",
      juros: "0,00",
      jurosTipo: "percentual",
      recebido: false,
    },
  ]);

  const algumaParcelaRecebida = parcelas.some((p) => p.recebido);

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setAlterarEntregue(true);
    setEnviarControleEntrega(false);
    setCodigoBarras("");
    setNumParcelas(1);
    setImprimirRecibo(false);
    const plano = carregarPlanoContas();
    const padrao =
      categoriaPadraoLancamento(plano, "receitas") || "Receitas de Serviços";
    setForm((f) => ({ ...f, categoria: padrao }));
  }, [open, setForm]);

  useEffect(() => {
    if (!open) return;
    function sincronizarCategoriaPlano() {
      const plano = carregarPlanoContas();
      const analiticas = contasAnaliticasPlano(plano, "receitas");
      const padrao = categoriaPadraoLancamento(plano, "receitas");
      setForm((f) => {
        const aindaExiste = analiticas.some((item) => item.nome === f.categoria);
        if (aindaExiste) return f;
        return { ...f, categoria: padrao || f.categoria };
      });
    }
    sincronizarCategoriaPlano();
    window.addEventListener(PLANO_CONTAS_ATUALIZADO_EVENT, sincronizarCategoriaPlano);
    return () =>
      window.removeEventListener(PLANO_CONTAS_ATUALIZADO_EVENT, sincronizarCategoriaPlano);
  }, [open, setForm]);

  useEffect(() => {
    const valorParcela =
      numParcelas > 0
        ? (totalAReceberComCredito / numParcelas).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "0,00";
    setParcelas((atual) =>
      Array.from({ length: numParcelas }, (_, i) => {
        const existente = atual[i];
        return {
          parcela: `${i + 1}/${numParcelas}`,
          formaPagamento: existente?.formaPagamento || form.formaPagamento || "Forma Pagamento",
          conta: existente?.conta || form.conta || "Caixa Principal",
          vencimento: existente?.vencimento || form.vencimento || dateToBrShort(new Date()),
          valor: valorParcela,
          valorTipo: existente?.valorTipo || "valor",
          juros: existente?.juros || form.juros || "0,00",
          jurosTipo: existente?.jurosTipo || (form.jurosTipo as "percentual" | "valor") || "percentual",
          recebido: existente?.recebido ?? form.recebido,
        };
      })
    );
  }, [
    numParcelas,
    totalAReceberComCredito,
    form.formaPagamento,
    form.conta,
    form.vencimento,
    form.juros,
    form.jurosTipo,
    form.recebido,
  ]);

  useEffect(() => {
    if (!algumaParcelaRecebida) setImprimirRecibo(false);
  }, [algumaParcelaRecebida]);

  useEffect(() => {
    const p = parcelas[0];
    if (!p) return;
    setForm((f) => ({
      ...f,
      parcela: p.parcela,
      formaPagamento: p.formaPagamento,
      conta: p.conta,
      vencimento: p.vencimento,
      juros: p.juros,
      jurosTipo: p.jurosTipo,
      recebido: p.recebido,
      status: p.recebido ? "pago" : "pendente",
    }));
  }, [parcelas, setForm]);

  function atualizarParcela(index: number, patch: Partial<ParcelaLinhaReceita>) {
    setParcelas((lista) => lista.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function enviarFormulario(e: React.FormEvent) {
    e.preventDefault();
    void onSubmit({ form, parcelas, imprimirRecibo, alterarEntregue });
  }

  if (!open || !portalPronto) return null;

  const semOs = form.semOs;
  const valorBrutoExibicao = semOs ? totalLiquido : valorOsSelecionadas;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-6">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lancar-receita-os-titulo"
        className="relative my-4 flex w-full max-w-[1080px] flex-col rounded-sm border border-[#e5e7eb] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
          <h2 id="lancar-receita-os-titulo" className="text-[15px] font-normal text-[#374151]">
            Lançar Receita
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={enviarFormulario} className="max-h-[calc(100vh-5rem)] overflow-y-auto px-5 py-4 text-[12px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3f4f6] pb-4">
            <ToggleSmart
              checked={semOs}
              onChange={(v) => setForm((f) => ({ ...f, semOs: v }))}
              label="Lançar uma Cobrança ou Outras Receitas sem O.S."
            />
            <div className="w-full min-w-[200px] max-w-[280px]">
              <label className={labelClass}>Categorias</label>
              <PlanoContasCategoriaSelect
                secao="receitas"
                value={form.categoria}
                onChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
                triggerClassName={fieldClass}
                menuEmPortal
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div>
              <label className={labelClass}>Cliente</label>
              <select
                value={form.clienteId}
                onChange={(e) => {
                  setForm((f) => ({ ...f, clienteId: e.target.value }));
                  onLimparOsSelecionadas();
                }}
                className={fieldClass}
              >
                <option value="">Selecione</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Conveniado</label>
              <select
                value={form.convenio}
                onChange={(e) => setForm((f) => ({ ...f, convenio: e.target.value }))}
                className={fieldClass}
              >
                <option value="">Selecione</option>
                <option value="Particular">Particular</option>
                <option value="Convênio">Convênio</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Período (data entrega)</label>
              <div className="grid grid-cols-2 gap-2">
                <CampoDataBr
                  value={form.pedidoInicio}
                  onChange={(v) => setForm((f) => ({ ...f, pedidoInicio: v }))}
                  className="space-y-0"
                  inputClassName={fieldClass}
                  placeholder="Data Inicial"
                />
                <CampoDataBr
                  value={form.pedidoFinal}
                  onChange={(v) => setForm((f) => ({ ...f, pedidoFinal: v }))}
                  className="space-y-0"
                  inputClassName={fieldClass}
                  placeholder="Data Final"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Situação</label>
              <select
                value={form.situacaoOs}
                onChange={(e) => {
                  setForm((f) => ({ ...f, situacaoOs: e.target.value }));
                  onLimparOsSelecionadas();
                }}
                className={fieldClass}
              >
                <option value="">Selecione</option>
                {Object.entries(STATUS_TRABALHO).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
                <option value="produto">Produto</option>
                <option value="transporte">Transporte</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex min-w-[240px] flex-1 overflow-hidden rounded-sm border border-[#d1d5db]">
              <input
                type="text"
                placeholder="OS, serviço e paciente"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                className="min-w-0 flex-1 border-0 bg-white px-3 py-2 text-[13px] outline-none"
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, descricao: "" }))}
                className="shrink-0 border-l border-[#d1d5db] bg-[#f9fafb] px-4 text-[13px] text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                Limpar
              </button>
            </div>
            <div className="flex min-w-[220px] flex-1 items-center gap-2">
              <Barcode className="h-5 w-5 shrink-0 text-[#6b7280]" />
              <input
                type="text"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="Leitor de Código de Barras"
                className={fieldClass}
              />
            </div>
          </div>

          {!semOs ? (
            <div className="mt-4 overflow-hidden rounded-sm border border-[#e5e7eb]">
              {!form.clienteId || !form.situacaoOs ? (
                <p className="px-4 py-10 text-center text-[13px] text-[#9ca3af]">
                  Selecione um cliente e uma situação para listar as OS.
                </p>
              ) : trabalhosParaReceita.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-[#9ca3af]">
                  Nenhuma OS encontrada para este cliente e situação.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse text-[12px]">
                    <thead>
                      <tr className="bg-[#f3f4f6] text-[11px] font-semibold uppercase text-[#6b7280]">
                        <th className="px-3 py-2.5 text-left">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={todasReceitaSelecionadas}
                              ref={(el) => {
                                if (el) {
                                  el.indeterminate =
                                    algumasReceitaSelecionadas && !todasReceitaSelecionadas;
                                }
                              }}
                              onChange={toggleSelecionarTodasReceita}
                              className="h-4 w-4 accent-[#4a90d9]"
                            />
                            <span>Selecionar</span>
                          </div>
                        </th>
                        <th className="px-3 py-2.5 text-left">OS</th>
                        <th className="px-3 py-2.5 text-left">Cliente</th>
                        <th className="px-3 py-2.5 text-left">Paciente</th>
                        <th className="px-3 py-2.5 text-left">Serviço</th>
                        <th className="px-3 py-2.5 text-left">Situação</th>
                        <th className="px-3 py-2.5 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trabalhosParaReceita.map((trabalho) => (
                        <tr
                          key={trabalho.id}
                          className={cn(
                            "border-t border-[#f3f4f6]",
                            osSelecionadas.includes(trabalho.id) && "bg-[#eff6ff]"
                          )}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={osSelecionadas.includes(trabalho.id)}
                              onChange={() => toggleOsReceita(trabalho.id)}
                              className="h-4 w-4 accent-[#4a90d9]"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-[#374151]">
                            {trabalho.numeroOs}
                          </td>
                          <td className="px-3 py-2">{trabalho.cliente?.nome || "—"}</td>
                          <td className="px-3 py-2">{trabalho.paciente?.nome || "—"}</td>
                          <td className="px-3 py-2">{trabalho.tipoProtese}</td>
                          <td className="px-3 py-2">
                            <SituacaoOsBadgeReceita trabalho={trabalho} />
                          </td>
                          <td className="px-3 py-2 text-right">{money(valorTrabalho(trabalho))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-[#f3f4f6] px-3 py-2 text-right text-[12px] font-semibold text-[#374151]">
                    Total selecionado: {money(valorOsSelecionadas)}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-3 pt-1">
              <ToggleSmart
                checked={alterarEntregue}
                onChange={setAlterarEntregue}
                label={`Altera Situação para 'Entregue'`}
              />
              <ToggleSmart
                checked={enviarControleEntrega}
                onChange={setEnviarControleEntrega}
                label="Enviar Controle Entrega..."
              />
            </div>

            <div className="w-full max-w-[320px] space-y-0 text-[13px]">
              <div className="flex items-center justify-between border-b border-[#f3f4f6] py-2.5">
                <span className="text-[#6b7280]">Valor Total</span>
                {semOs ? (
                  <input
                    type="text"
                    value={form.valor}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        valor: formatDecimalInput(e.target.value),
                      }))
                    }
                    className={cn(fieldClass, "h-8 max-w-[120px] text-right")}
                  />
                ) : (
                  <span className="font-medium text-[#374151]">{money(valorBrutoExibicao)}</span>
                )}
              </div>
              <div className="flex items-center justify-between border-b border-[#f3f4f6] py-2.5">
                <span className="text-[#6b7280]">Desconto</span>
                <div className="flex overflow-hidden rounded-sm border border-[#d1d5db]">
                  <select
                    value={form.descontoTipo}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        descontoTipo: e.target.value,
                        desconto: e.target.value === "valor" ? "R$ 0,00" : "0,00",
                      }))
                    }
                    className="h-[30px] w-12 border-r border-[#d1d5db] bg-white text-center text-[12px] outline-none"
                  >
                    <option value="percentual">%</option>
                    <option value="valor">R$</option>
                  </select>
                  <input
                    type="text"
                    value={form.desconto}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        desconto:
                          f.descontoTipo === "valor"
                            ? formatCurrencyInput(e.target.value)
                            : formatDecimalInput(e.target.value),
                      }))
                    }
                    className="h-[30px] w-20 border-0 bg-white px-2 text-right text-[12px] outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="font-semibold text-[#4a90d9]">Total Líquido</span>
                <span className="text-[15px] font-bold text-[#4a90d9]">{currency(totalLiquido)}</span>
              </div>
              {creditoAplicado > 0 ? (
                <>
                  <div className="flex items-center justify-between border-t border-[#f3f4f6] py-2 text-emerald-700">
                    <span>Desconto com crédito</span>
                    <span>- {currency(creditoAplicado)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 font-semibold text-[#374151]">
                    <span>Total a cobrar</span>
                    <span>{currency(totalAReceberComCredito)}</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <p className="mt-6 text-center text-[12px] text-[#6b7280]">
            Escolha a(s) forma(s) de recebimento
          </p>

          {formaSelecionadaEhBoleto() ? (
            <p className="mb-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-900">
              Com <strong>Boleto</strong>, o sistema emite automaticamente no Asaas ao cadastrar.
            </p>
          ) : null}

          {mensagemLancamento ? (
            <p
              role="alert"
              className={cn(
                "mb-3 rounded-sm px-3 py-2 text-center text-[11px]",
                mensagemLancamentoTipo === "erro"
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-800"
              )}
            >
              {mensagemLancamento}
            </p>
          ) : null}

          <div className="rounded-sm border border-[#d1d5db] bg-[#fafafa] p-3">
            <div className="mb-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#6b7280]">Parcelas</span>
                <button
                  type="button"
                  onClick={() => setNumParcelas((n) => Math.max(1, n - 1))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#d1d5db] bg-white text-[#374151] hover:bg-[#f3f4f6]"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="text"
                  readOnly
                  value={String(numParcelas)}
                  className={cn(fieldClass, "h-7 w-12 text-center")}
                />
                <button
                  type="button"
                  onClick={() => setNumParcelas((n) => Math.min(24, n + 1))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#d1d5db] bg-white text-[#374151] hover:bg-[#f3f4f6]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {algumaParcelaRecebida ? (
                <ToggleSmart
                  checked={imprimirRecibo}
                  onChange={setImprimirRecibo}
                  label="Imprimir Recibo"
                />
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-[11px]">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase text-[#6b7280]">
                    <th className="px-2 py-2 text-left">Parcela</th>
                    <th className="px-2 py-2 text-left">Forma Recebimento</th>
                    <th className="px-2 py-2 text-left">Conta</th>
                    <th className="px-2 py-2 text-left">Vencimento</th>
                    <th className="px-2 py-2 text-left">Valor</th>
                    <th className="px-2 py-2 text-left">Juros</th>
                    <th className="px-2 py-2 text-center">Recebido</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((p, index) => (
                    <tr key={index} className="border-t border-[#e5e7eb]">
                      <td className="px-1 py-1">
                        <input
                          type="text"
                          readOnly
                          value={p.parcela}
                          className={cn(fieldClass, "h-8 bg-[#f9fafb] text-center")}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <select
                          value={p.formaPagamento}
                          onChange={(e) =>
                            atualizarParcela(index, { formaPagamento: e.target.value })
                          }
                          className={cn(fieldClass, "h-8")}
                        >
                          <option>Forma Pagamento</option>
                          <option>Dinheiro</option>
                          <option>Pix</option>
                          <option>Cartão de Crédito</option>
                          <option>Cartão de Débito</option>
                          <option>Boleto Bancário</option>
                          <option>Transferência Bancária</option>
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <select
                          value={p.conta}
                          onChange={(e) => atualizarParcela(index, { conta: e.target.value })}
                          className={cn(fieldClass, "h-8")}
                        >
                          <option>Caixa Principal</option>
                          <option>Conta Bancária</option>
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <CampoDataBr
                          value={p.vencimento}
                          onChange={(v) => atualizarParcela(index, { vencimento: v })}
                          className="space-y-0"
                          inputClassName={cn(fieldClass, "h-8")}
                          calendarPosition="relative"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <CampoMoedaOuPercentual
                          tipo={p.valorTipo}
                          valor={p.valor}
                          onTipoChange={(valorTipo) =>
                            atualizarParcela(index, {
                              valorTipo,
                              valor: valorTipo === "valor" ? "R$ 0,00" : "0,00",
                            })
                          }
                          onValorChange={(valor) => atualizarParcela(index, { valor })}
                          formatDecimalInput={formatDecimalInput}
                          formatCurrencyInput={formatCurrencyInput}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <CampoMoedaOuPercentual
                          tipo={p.jurosTipo}
                          valor={p.juros}
                          onTipoChange={(jurosTipo) =>
                            atualizarParcela(index, {
                              jurosTipo,
                              juros: jurosTipo === "valor" ? "R$ 0,00" : "0,00",
                            })
                          }
                          onValorChange={(juros) => atualizarParcela(index, { juros })}
                          formatDecimalInput={formatDecimalInput}
                          formatCurrencyInput={formatCurrencyInput}
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={p.recebido}
                          onClick={() => {
                            const recebido = !p.recebido;
                            atualizarParcela(index, { recebido });
                            if (!recebido) setImprimirRecibo(false);
                          }}
                          className={cn(
                            "relative mx-auto inline-flex h-5 w-9 rounded-full transition",
                            p.recebido ? "bg-[#4a90d9]" : "bg-[#cbd5e1]"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                              p.recebido ? "left-[18px]" : "left-0.5"
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4">
            <label className={labelClass}>Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              rows={4}
              className="w-full rounded-sm border border-[#d1d5db] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#f3f4f6] pt-4">
            <button
              type="submit"
              className="h-10 rounded-sm bg-[#4a90d9] text-[13px] font-normal text-white hover:bg-[#3d7fc4]"
            >
              Cadastrar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-sm border border-[#d1d5db] bg-white text-[13px] font-normal text-[#374151] hover:bg-[#f9fafb]"
            >
              Fechar
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
