"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { CampoDataBr } from "@/components/ui";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
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

export type PagarDespesaConfirmadoDetail = {
  anexarComprovante?: boolean;
  lancamentoIds?: string[];
};

type Props = {
  open: boolean;
  lancamento: LancamentoDespesaDetalhe | null;
  refOs?: string;
  todosLancamentos: LancamentoDespesaDetalhe[];
  onClose: () => void;
  onConfirmado: (detail?: PagarDespesaConfirmadoDetail) => void;
};

const labelClass =
  "mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500";
const inputClass =
  "h-8 w-full rounded-sm border border-slate-300 bg-white px-2 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";
const selectClass = inputClass;
const thClass =
  "border-b border-slate-200 bg-[#f5f6f8] px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500";
const tdClass = "border-b border-slate-100 px-2.5 py-2 text-[12px] text-slate-800";

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

function formatVencimentoParcela(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}`;
  return formatDate(iso);
}

function textoFormaPagamentoParcela(forma?: string) {
  const valor = forma?.trim();
  return valor || "Não Informado";
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
        "relative mx-auto inline-flex h-5 w-9 shrink-0 rounded-full transition",
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
  const [alerta, setAlerta] = useState("");

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
    setAlerta("");
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
      setAlerta("Selecione ao menos uma parcela para pagar.");
      return;
    }
    const forma = formas[0];
    if (!forma?.forma?.trim()) {
      setAlerta("Informe a forma de pagamento.");
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
          setAlerta(json.error || "Não foi possível confirmar o pagamento.");
          return;
        }
      }
      onConfirmado(
        anexarComprovante
          ? { anexarComprovante: true, lancamentoIds: ids }
          : undefined
      );
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  const conteudo = (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-6"
      data-modal="pagar-despesa-smart"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pagar-despesa-titulo"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative my-auto flex w-full max-w-[1080px] flex-col overflow-visible rounded-md bg-white shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900">
        <div className="rounded-t bg-slate-50 px-5 py-4 dark:bg-slate-800">
          <h2
            id="pagar-despesa-titulo"
            className="pr-8 text-base font-medium text-slate-600 dark:text-slate-200"
          >
            Pagar Despesa
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-[-8px] top-[-3px] flex h-9 w-9 items-center justify-center rounded-md bg-white text-slate-500 shadow-md hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="max-h-[calc(100vh-5rem)] overflow-y-auto px-5 py-4 text-[12px] text-slate-700">
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-slate-100 pb-3">
            <p>
              <span className="text-slate-600">Data de Lançamento:</span>{" "}
              <span className="text-slate-800">
                {formatDateTime(dados.dataLancamento) || formatDate(dados.dataLancamento)}
              </span>
            </p>
            <p>
              <span className="text-slate-600">Nota Fiscal/Referência:</span>{" "}
              <span className="text-slate-800">{notaRef || ""}</span>
            </p>
            <p>
              <span className="text-slate-600">Fornecedor:</span>{" "}
              <span className="text-slate-800">{dados.nomeEntidade}</span>
            </p>
            <p>
              <span className="text-slate-600">Categoria:</span>{" "}
              <span className="text-slate-800">{dados.categoria}</span>
            </p>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
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
                  <tr key={item.id}>
                    <td className={tdClass}>{item.produto}</td>
                    <td className={tdClass}>{item.descricao}</td>
                    <td className={cn(tdClass, "text-slate-700")}>
                      {exibirQuantidade(item.quantidade)}
                    </td>
                    <td className={cn(tdClass, "text-right")}>{item.custoUnitario}</td>
                    <td className={cn(tdClass, "text-right font-medium")}>
                      {money(subtotalItem(item))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-1 flex justify-end pr-1 text-[12px]">
            <span className="font-semibold text-[#4a90d9]">
              Total Líquido {money(dados.totalLiquido)}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  <th className={cn(thClass, "w-14")}>Parcela</th>
                  <th className={thClass}>Forma Pagamento</th>
                  <th className={thClass}>Conta</th>
                  <th className={thClass}>Vencimento</th>
                  <th className={cn(thClass, "text-right")}>Valor</th>
                  <th className={cn(thClass, "w-20 text-center")}>Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((parcela, index) => {
                  const ativa = parcela.pago || parcela.pagarAgora;
                  return (
                    <tr key={`${parcela.parcela}-${index}`}>
                      <td className={tdClass}>{parcela.parcela}</td>
                      <td className={cn(tdClass, "text-slate-600")}>
                        {textoFormaPagamentoParcela(parcela.formaPagamento)}
                      </td>
                      <td className={tdClass}>{parcela.conta}</td>
                      <td className={tdClass}>{formatVencimentoParcela(parcela.vencimento)}</td>
                      <td className={cn(tdClass, "text-right")}>{parcela.valor}</td>
                      <td className={cn(tdClass, "text-center")}>
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
          <div className="mt-1 flex justify-end pr-1 text-[12px]">
            <span className="font-semibold text-red-600">
              Valor Devido {money(dados.valorDevido)}
            </span>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-3 w-[150px]">
              <span className={labelClass}>Data Pagamento</span>
              <CampoDataBr
                value={dataPagamento}
                onChange={setDataPagamento}
                className="space-y-0"
                inputClassName={inputClass}
              />
            </div>

            {formas.map((forma) => {
              const totalLinha = parseMoney(forma.valor) + parseMoney(forma.juros);
              return (
                <div
                  key={forma.id}
                  className="grid grid-cols-5 gap-2"
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
                      <option value="" />
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

            <div className="mt-3 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() =>
                  setFormas((lista) => [...lista, novaFormaPagamento("0,00")])
                }
                className="inline-flex items-center gap-1 rounded-sm border border-[#4cae4c] bg-[#4cae4c] px-3 py-1.5 text-[12px] font-normal text-white hover:bg-[#449d44]"
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
          </div>

          <div className="mt-5 flex justify-end gap-3 pt-1">
            <button
              type="button"
              disabled={salvando}
              onClick={onClose}
              className="h-10 rounded-md border border-slate-300 bg-white px-8 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => void confirmarPagamento()}
              className="h-10 rounded-md bg-[#4a90d9] px-8 text-sm font-semibold text-white hover:bg-[#3d7fc4] disabled:opacity-60"
            >
              {salvando ? "Confirmando…" : "Confirmar Pagamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <I18nPortal>
      {conteudo}
      <ConfirmacaoExclusaoModal
        open={Boolean(alerta)}
        titulo="Aviso"
        mensagem={alerta}
        modo="alerta"
        onClose={() => setAlerta("")}
        onConfirm={() => setAlerta("")}
      />
    </I18nPortal>,
    document.body
  );
}
