"use client";

import { ExternalLink, X } from "lucide-react";
import { STATUS_ORCAMENTO, totalLiquidoOrcamento, type Orcamento } from "@/lib/orcamentos-types";
import {
  parseCondicoesPagamento,
  rotuloCondicoesPagamento,
} from "@/lib/orcamentos-pagamento";
import { formatCurrency, formatDate } from "@/lib/utils";

type Props = {
  open: boolean;
  orcamento: Orcamento | null;
  onClose: () => void;
  onAprovar: (orcamento: Orcamento) => void;
  onRecusar: (orcamento: Orcamento) => void;
  onReabrirLink?: (orcamento: Orcamento) => void;
  processando?: boolean;
};

export function OrcamentoRespostaModal({
  open,
  orcamento,
  onClose,
  onAprovar,
  onRecusar,
  onReabrirLink,
  processando = false,
}: Props) {
  if (!open || !orcamento) return null;

  const descontoValor =
    orcamento.descontoPercentual > 0
      ? orcamento.subtotal * (orcamento.descontoPercentual / 100)
      : orcamento.desconto;
  const liquido = totalLiquidoOrcamento(
    orcamento.subtotal,
    orcamento.desconto,
    orcamento.descontoPercentual
  );
  const status = STATUS_ORCAMENTO[orcamento.status];
  const podeAprovar = orcamento.status === "enviado";

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-medium text-slate-700">
              Orçamento do Fornecedor — Pedido #{orcamento.numeroPedido}
            </h2>
            <p className="text-[11px] text-slate-500">{orcamento.fornecedorNome}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[11px] text-slate-600">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span
              className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
            >
              {status.label}
            </span>
            <span>
              <span className="text-slate-500">Data resposta:</span>{" "}
              {formatDate(orcamento.dataResposta)}
            </span>
          </div>

          <div className="overflow-hidden rounded-sm border border-slate-200">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-3 py-2 text-left font-semibold uppercase">Produto</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Marca</th>
                  <th className="px-3 py-2 text-center font-semibold uppercase">Qtd</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Valor Unit.</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {orcamento.itens.map((item, index) => (
                  <tr key={`${item.produtoId}-${index}`} className="border-t border-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700">{item.produtoNome}</td>
                    <td className="px-3 py-2 text-slate-500">{item.marca || ""}</td>
                    <td className="px-3 py-2 text-center">{item.quantidade}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(item.valorUnitario)}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(item.quantidade * item.valorUnitario)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Valor total:</span>
                <span className="font-medium">{formatCurrency(orcamento.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Desconto:</span>
                <span>{formatCurrency(descontoValor)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-1.5 text-sm font-semibold text-blue-600">
                <span>Total líquido:</span>
                <span>{formatCurrency(liquido)}</span>
              </div>
            </div>
          </div>

          {orcamento.observacoes && (
            <div className="mt-4">
              <p className="mb-1 font-medium text-slate-700">Observação</p>
              <p className="rounded-sm border border-slate-100 bg-slate-50 p-2 text-slate-600">
                {orcamento.observacoes}
              </p>
            </div>
          )}

          {orcamento.condicoesPagamento && (
            <div className="mt-3">
              <p className="mb-1 font-medium text-slate-700">Condições de pagamento</p>
              <p className="rounded-sm border border-slate-100 bg-slate-50 p-2 text-slate-600">
                {rotuloCondicoesPagamento(
                  parseCondicoesPagamento(orcamento.condicoesPagamento)
                )}
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-sm border border-slate-300 bg-white px-4 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Fechar
          </button>
          {podeAprovar && onReabrirLink && (
            <button
              type="button"
              disabled={processando}
              onClick={() => onReabrirLink(orcamento)}
              className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-blue-200 bg-blue-50 px-4 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
              title="Reabre o link para editar e reenvia ao fornecedor pelo WhatsApp"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Editar / Reenviar link
            </button>
          )}
          {podeAprovar && (
            <>
              <button
                type="button"
                disabled={processando}
                onClick={() => onRecusar(orcamento)}
                className="h-9 rounded-sm border border-red-200 bg-red-50 px-4 text-[11px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
              >
                Recusar
              </button>
              <button
                type="button"
                disabled={processando}
                onClick={() => onAprovar(orcamento)}
                className="h-9 rounded-sm bg-emerald-500 px-4 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                Aprovar Orçamento
              </button>
            </>
          )}
          {orcamento.status === "aprovado" && (
            <span className="flex h-9 items-center rounded-sm bg-emerald-50 px-4 text-[11px] font-medium text-emerald-700">
              Orçamento aprovado
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
