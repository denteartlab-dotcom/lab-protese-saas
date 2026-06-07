"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { CampoDataBr } from "@/components/ui";
import { brShortToIso, dateToBrShort } from "@/lib/datas-br";
import {
  extrairDadosPagarDespesa,
  type LancamentoDespesaDetalhe,
  type ParcelaPagarDespesa,
} from "@/lib/lancamento-despesa";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

type FormaPagamentoLinha = {
  id: string;
  forma: string;
  conta: string;
  valor: string;
  juros: string;
};

type Props = {
  open: boolean;
  lancamento: LancamentoDespesaDetalhe | null;
  refOs?: string;
  todosLancamentos: LancamentoDespesaDetalhe[];
  onClose: () => void;
  onConfirmado: () => void;
};

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const inputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";
const selectClass = inputClass;
const thClass =
  "border-b border-slate-200 bg-[#f5f6f8] px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500";

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoney(value: string) {
  return (
    Number(
      value
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    ) || 0
  );
}

function formatMoneyInput(value: string) {
  const amount = Number(value.replace(/\D/g, "")) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function exibirQuantidade(qtd: string) {
  const valor = qtd.trim() || "1";
  if (/[a-zA-Z]/.test(valor)) return valor;
  return `${valor} un`;
}

function subtotalItem(item: { quantidade: string; custoUnitario: string }) {
  const qtd = Number(item.quantidade.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  const unit = parseMoney(item.custoUnitario);
  return qtd * unit;
}

function badgeFormaPagamento(forma?: string) {
  const valor = forma?.trim();
  if (!valor) {
    return (
      <span className="inline-block whitespace-nowrap rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
        Não Informado
      </span>
    );
  }
  return valor;
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative mx-auto inline-flex h-5 w-9 rounded-full transition",
        checked ? "bg-[#4cae4c]" : "bg-slate-300",
        disabled && "cursor-default opacity-80"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
          checked ? "left-[18px]" : "left-0.5"
        )}
      />
    </button>
  );
}

function novaFormaPagamento(valor = "0,00"): FormaPagamentoLinha {
  return {
    id: `fp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    forma: "",
    conta: "Caixa Principal",
    valor,
    juros: "0,00",
  };
}

export function PagarDespesaModal({
  open,
  lancamento,
  refOs,
  todosLancamentos,
  onClose,
  onConfirmado,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [parcelas, setParcelas] = useState<ParcelaPagarDespesa[]>([]);
  const [dataPagamento, setDataPagamento] = useState(dateToBrShort(new Date()));
  const [formas, setFormas] = useState<FormaPagamentoLinha[]>([novaFormaPagamento()]);
  const [anexarComprovante, setAnexarComprovante] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const dados = useMemo(
    () =>
      lancamento
        ? extrairDadosPagarDespesa(lancamento, refOs, todosLancamentos)
        : null,
    [lancamento, refOs, todosLancamentos]
  );

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!open || !dados) return;
    setParcelas(dados.parcelasGrupo.map((p) => ({ ...p })));
    const parcelaPagar = dados.parcelasGrupo.find((p) => p.pagarAgora);
    setFormas([novaFormaPagamento(parcelaPagar?.valor || dados.parcelasGrupo[0]?.valor || "0,00")]);
    setDataPagamento(
      parcelaPagar?.vencimento
        ? formatDate(parcelaPagar.vencimento) || dateToBrShort(new Date())
        : dateToBrShort(new Date())
    );
    setAnexarComprovante(false);
  }, [open, dados]);

  if (!open || !lancamento || !dados || !portalPronto) return null;

  const notaRef =
    dados.notaFiscalRef ||
    (refOs && !/^OS\s+\d+/i.test(refOs) ? refOs : "");

  function toggleParcela(index: number) {
    const alvo = parcelas[index];
    if (alvo.pago || !alvo.lancamentoId) return;
    setParcelas((lista) =>
      lista.map((p, i) =>
        i === index ? { ...p, pagarAgora: !p.pagarAgora } : p
      )
    );
    if (!alvo.pagarAgora) {
      setFormas((lista) => {
        const proxima = [...lista];
        proxima[0] = { ...proxima[0], valor: alvo.valor };
        return proxima;
      });
    }
  }

  function atualizarForma(id: string, patch: Partial<FormaPagamentoLinha>) {
    setFormas((lista) =>
      lista.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  async function confirmarPagamento() {
    const ids = parcelas
      .filter((p) => p.pagarAgora && !p.pago && p.lancamentoId)
      .map((p) => p.lancamentoId as string);
    if (!ids.length) {
      alert("Selecione ao menos uma parcela para pagar.");
      return;
    }
    const forma = formas[0];
    if (!forma?.forma?.trim()) {
      alert("Informe a forma de pagamento.");
      return;
    }

    setSalvando(true);
    try {
      for (const id of ids) {
        const res = await fetch(`/api/financeiro/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "pago",
            formaPagamento: forma.forma,
            data: brShortToIso(dataPagamento),
          }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          alert(json.error || "Não foi possível confirmar o pagamento.");
          return;
        }
      }
      if (anexarComprovante) {
        alert("Pagamento confirmado. Você pode anexar o comprovante ao editar a despesa.");
      }
      onConfirmado();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  const conteudo = (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-8"
      data-modal="pagar-despesa-smart"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pagar-despesa-titulo"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative my-auto flex w-full max-w-[1060px] flex-col rounded border border-slate-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <h2 id="pagar-despesa-titulo" className="text-[14px] font-normal text-slate-800">
            Pagar Despesa
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(100vh-6rem)] overflow-y-auto px-4 py-3 text-[11px] text-slate-700">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <p className="text-[12px] text-slate-700">
              <span className="font-medium text-slate-600">Data de Lançamento:</span>{" "}
              {formatDateTime(dados.dataLancamento) || formatDate(dados.dataLancamento)}
            </p>
            <p className="text-[12px] text-slate-700">
              <span className="font-medium text-slate-600">Nota Fiscal/Referência:</span>{" "}
              {notaRef || ""}
            </p>
            <p className="text-[12px] text-slate-700">
              <span className="font-medium text-slate-600">Fornecedor:</span>{" "}
              {dados.nomeEntidade}
            </p>
            <p className="text-[12px] text-slate-700">
              <span className="font-medium text-slate-600">Categoria:</span>{" "}
              {dados.categoria}
            </p>
          </div>

          <div className="mt-4 overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[640px] border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className={thClass}>Produto</th>
                  <th className={thClass}>Descrição</th>
                  <th className={thClass}>Quantidade</th>
                  <th className={cn(thClass, "text-right")}>Custo Unitário</th>
                  <th className={cn(thClass, "text-right")}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-slate-800">{item.produto}</td>
                    <td className="px-2 py-2 text-slate-800">{item.descricao}</td>
                    <td className="px-2 py-2 text-slate-700">
                      {exibirQuantidade(item.quantidade)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-800">
                      {item.custoUnitario}
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-slate-800">
                      {money(subtotalItem(item))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-1 flex justify-end text-[12px]">
            <span className="font-semibold text-[#4a90d9]">
              Total Líquido {money(dados.totalLiquido)}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[760px] border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className={cn(thClass, "w-16")}>Parcela</th>
                  <th className={thClass}>Forma Pagamento</th>
                  <th className={thClass}>Conta</th>
                  <th className={thClass}>Vencimento</th>
                  <th className={cn(thClass, "text-right")}>Valor</th>
                  <th className={cn(thClass, "text-center w-20")}>Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((parcela, index) => {
                  const ativa = parcela.pago || parcela.pagarAgora;
                  return (
                    <tr key={`${parcela.parcela}-${index}`} className="border-t border-slate-100">
                      <td className="px-2 py-2 text-slate-800">{parcela.parcela}</td>
                      <td className="px-2 py-2">
                        {badgeFormaPagamento(parcela.formaPagamento)}
                      </td>
                      <td className="px-2 py-2 text-slate-700">{parcela.conta}</td>
                      <td className="px-2 py-2 text-slate-800">
                        {formatDate(parcela.vencimento)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-800">{parcela.valor}</td>
                      <td className="px-2 py-2 text-center">
                        <Toggle
                          checked={ativa}
                          disabled={parcela.pago || !parcela.lancamentoId}
                          onChange={() => toggleParcela(index)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-1 flex justify-end text-[12px]">
            <span className="font-semibold text-red-600">
              Valor Devido {money(dados.valorDevido)}
            </span>
          </div>

          <div className="mt-4">
            <span className={labelClass}>Data Pagamento</span>
            <div className="max-w-[160px]">
              <CampoDataBr
                value={dataPagamento}
                onChange={setDataPagamento}
                className="space-y-0"
                inputClassName={inputClass}
              />
            </div>
          </div>

          {formas.map((forma) => {
            const totalLinha = parseMoney(forma.valor) + parseMoney(forma.juros);
            return (
              <div
                key={forma.id}
                className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5"
              >
                <div>
                  <span className={labelClass}>Forma Pagamento</span>
                  <select
                    value={forma.forma}
                    onChange={(e) =>
                      atualizarForma(forma.id, { forma: e.target.value })
                    }
                    className={selectClass}
                  >
                    <option value="">Selecione</option>
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Transferência">Transferência</option>
                  </select>
                </div>
                <div>
                  <span className={labelClass}>Conta</span>
                  <select
                    value={forma.conta}
                    onChange={(e) =>
                      atualizarForma(forma.id, { conta: e.target.value })
                    }
                    className={selectClass}
                  >
                    <option>Caixa Principal</option>
                    <option>Conta Bancária</option>
                  </select>
                </div>
                <div>
                  <span className={labelClass}>Valor</span>
                  <input
                    type="text"
                    value={forma.valor}
                    onChange={(e) =>
                      atualizarForma(forma.id, {
                        valor: formatMoneyInput(e.target.value),
                      })
                    }
                    className={cn(inputClass, "text-right")}
                  />
                </div>
                <div>
                  <span className={labelClass}>Juros</span>
                  <input
                    type="text"
                    value={forma.juros}
                    onChange={(e) =>
                      atualizarForma(forma.id, {
                        juros: formatMoneyInput(e.target.value),
                      })
                    }
                    className={cn(inputClass, "text-right")}
                  />
                </div>
                <div>
                  <span className={labelClass}>Total Pagamento</span>
                  <input
                    type="text"
                    readOnly
                    value={money(totalLinha)}
                    className={cn(inputClass, "bg-slate-50 text-right")}
                  />
                </div>
              </div>
            );
          })}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setFormas((lista) => [
                  ...lista,
                  novaFormaPagamento("0,00"),
                ])
              }
              className="inline-flex items-center gap-1.5 rounded border border-[#4cae4c] bg-[#4cae4c] px-3 py-1.5 text-[12px] font-normal text-white hover:bg-[#449d44]"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Forma de Pagamento
            </button>
            <div className="flex items-center gap-2">
              <Toggle
                checked={anexarComprovante}
                onChange={() => setAnexarComprovante((v) => !v)}
              />
              <span className="text-[12px] text-slate-600">
                Deseja anexar comprovante após pagar?
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={salvando}
              onClick={() => void confirmarPagamento()}
              className="h-10 rounded bg-[#4a90d9] text-[13px] font-normal text-white hover:bg-[#3d7fc4] disabled:opacity-60"
            >
              {salvando ? "Confirmando…" : "Confirmar Pagamento"}
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={onClose}
              className="h-10 rounded border border-slate-300 bg-white text-[13px] font-normal text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(conteudo, document.body);
}
