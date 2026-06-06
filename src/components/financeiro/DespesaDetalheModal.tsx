"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Barcode, FileText } from "lucide-react";
import {
  extrairDadosVisualizacaoDespesa,
  labelNomeEntidadeDespesa,
  TIPOS_FORNECEDOR_DESPESA,
  type AnexoDespesa,
  type LancamentoDespesaDetalhe,
} from "@/lib/lancamento-despesa";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  open: boolean;
  lancamento: LancamentoDespesaDetalhe | null;
  refOs?: string;
  onClose: () => void;
  onEditar: () => void;
  onAnexoClick: (anexo: AnexoDespesa) => void;
};

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const inputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";
const readOnlyClass = cn(inputClass, "cursor-default bg-slate-50 text-slate-700");

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function subtotalItem(item: {
  quantidade: string;
  custoUnitario: string;
}) {
  const qtd = Number(item.quantidade.replace(",", ".")) || 0;
  const unit =
    Number(item.custoUnitario.replace(/\./g, "").replace(",", ".")) || 0;
  return qtd * unit;
}

function AnexoSomenteLeitura({
  anexo,
  onClick,
}: {
  anexo: AnexoDespesa;
  onClick: () => void;
}) {
  const isPdf =
    anexo.type === "application/pdf" || anexo.name.toLowerCase().endsWith(".pdf");

  return (
    <button
      type="button"
      onClick={onClick}
      className="overflow-hidden rounded border border-slate-200 bg-white text-left shadow-sm transition hover:border-[#4a90d9]"
      title={anexo.name}
    >
      {isPdf ? (
        <div className="flex h-20 flex-col items-center justify-center gap-1 bg-slate-50 text-[#4a90d9]">
          <FileText className="h-8 w-8" />
          <span className="text-[9px] font-medium uppercase">PDF</span>
        </div>
      ) : (
        <Image
          src={anexo.url}
          alt={anexo.name}
          width={120}
          height={96}
          unoptimized
          className="h-20 w-full object-cover"
        />
      )}
      <p className="truncate px-1 py-0.5 text-[9px] text-slate-500">{anexo.name}</p>
    </button>
  );
}

export function DespesaDetalheModal({
  open,
  lancamento,
  refOs,
  onClose,
  onEditar,
  onAnexoClick,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  const dados = useMemo(
    () => (lancamento ? extrairDadosVisualizacaoDespesa(lancamento, refOs) : null),
    [lancamento, refOs]
  );

  if (!open || !lancamento || !dados || !portalPronto) return null;

  const labelNome = labelNomeEntidadeDespesa(dados.tipoFornecedor);
  const tipoLabel =
    TIPOS_FORNECEDOR_DESPESA.find((t) => t.value === dados.tipoFornecedor)?.label ||
    "Fornecedor";

  const conteudo = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-8"
      data-modal="visualizar-despesa-smart"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visualizar-despesa-titulo"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative my-auto flex w-full max-w-[1060px] flex-col rounded border border-slate-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <h2
            id="visualizar-despesa-titulo"
            className="text-[14px] font-normal text-slate-800"
          >
            Visualizar Despesa
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
          <div className="grid grid-cols-12 items-end gap-x-3 gap-y-2">
            <div className="col-span-12 md:col-span-5">
              <label className={labelClass}>Nota fiscal — XML ou PDF (opcional)</label>
              <input
                type="text"
                readOnly
                value=""
                placeholder="Selecione XML ou PDF da NF-e"
                className={cn(readOnlyClass, "min-w-0")}
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <label className={labelClass}>Data de Lançamento</label>
              <input
                type="text"
                readOnly
                value={formatDate(dados.dataLancamento)}
                className={readOnlyClass}
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <label className={labelClass}>Nota Fiscal Referência</label>
              <input
                type="text"
                readOnly
                value={dados.notaFiscalRef}
                className={readOnlyClass}
              />
            </div>
            <div className="col-span-12 flex items-center justify-end gap-2 md:col-span-2 md:pb-0.5">
              <span className="text-[11px] text-slate-600">Despesa Fixa</span>
              <span
                role="switch"
                aria-checked={false}
                className="relative inline-flex h-5 w-9 shrink-0 cursor-default rounded-full bg-slate-300"
              >
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow" />
              </span>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-3">
              <label className={labelClass}>Tipo Fornecedor</label>
              <input type="text" readOnly value={tipoLabel} className={readOnlyClass} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>{labelNome}</label>
              <input
                type="text"
                readOnly
                value={dados.nomeEntidade}
                className={readOnlyClass}
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className={labelClass}>Categoria</label>
              <input
                type="text"
                readOnly
                value={dados.categoria}
                className={readOnlyClass}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Barcode className="h-5 w-5 text-slate-400" />
            <input
              type="text"
              readOnly
              value=""
              placeholder="Leitor de Código de Barras"
              className={cn(readOnlyClass, "max-w-md")}
            />
          </div>

          <div className="mt-2 overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-[#f5f6f8] text-[10px] font-semibold uppercase text-slate-500">
                  <th className="px-3 py-2 text-left">Produto</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="w-24 px-3 py-2 text-center">Quantidade</th>
                  <th className="w-28 px-3 py-2 text-right">Custo Unitário</th>
                  <th className="w-28 px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={item.produto}
                        className={readOnlyClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={item.descricao}
                        className={readOnlyClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={item.quantidade}
                        className={cn(readOnlyClass, "text-center")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={item.custoUnitario}
                        className={cn(readOnlyClass, "text-right")}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                      {money(subtotalItem(item))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap items-start justify-end gap-4">
            <div className="w-full max-w-xs space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Valor Total</span>
                <span className="font-medium text-slate-800">
                  {money(dados.valorBruto)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Desconto</span>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    readOnly
                    value="%"
                    className="h-8 w-12 rounded border border-slate-300 bg-slate-50 text-center text-[11px]"
                  />
                  <input
                    type="text"
                    readOnly
                    value="0,00"
                    className={cn(readOnlyClass, "h-8 w-24 text-right")}
                  />
                  <span className="text-slate-500">0,00</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold text-[#4a90d9]">Total Líquido</span>
                <span className="text-[15px] font-bold text-[#4a90d9]">
                  {money(dados.totalLiquido)}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[12px] text-slate-500">
            Escolha a(s) forma(s) de pagamento
          </p>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-slate-600">Parcelas</span>
            <input
              type="text"
              readOnly
              value={String(dados.numParcelas)}
              className={cn(readOnlyClass, "h-7 w-12 text-center")}
            />
          </div>

          <div className="mt-2 overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="bg-[#f5f6f8] text-[10px] font-semibold uppercase text-slate-500">
                  <th className="w-16 px-2 py-2 text-left">Parcela</th>
                  <th className="px-2 py-2 text-left">Forma Pagamento</th>
                  <th className="px-2 py-2 text-left">Conta</th>
                  <th className="px-2 py-2 text-left">Vencimento</th>
                  <th className="px-2 py-2 text-left">Cod. Barras / Pix</th>
                  <th className="w-24 px-2 py-2 text-right">Valor</th>
                  <th className="w-14 px-2 py-2 text-center">Pago</th>
                </tr>
              </thead>
              <tbody>
                {dados.parcelas.map((parcela, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={parcela.parcela}
                        className={cn(readOnlyClass, "text-center")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={parcela.formaPagamento || "Não Informado"}
                        className={readOnlyClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={parcela.conta}
                        className={readOnlyClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={formatDate(parcela.vencimento)}
                        className={readOnlyClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={parcela.codigoBarrasPix}
                        placeholder="Digite o código ou Pix..."
                        className={readOnlyClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={parcela.valor}
                        className={cn(readOnlyClass, "text-right")}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        role="switch"
                        aria-checked={parcela.pago}
                        className={cn(
                          "relative mx-auto inline-flex h-5 w-9 cursor-default rounded-full",
                          parcela.pago ? "bg-[#4a90d9]" : "bg-slate-300"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow",
                            parcela.pago ? "left-[18px]" : "left-0.5"
                          )}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <label className={labelClass}>Observações</label>
            <textarea
              readOnly
              value={dados.observacoes}
              rows={4}
              className="w-full cursor-default rounded border border-slate-300 bg-slate-50 px-3 py-2 text-[12px] text-slate-700 outline-none"
            />
          </div>

          <div className="mt-4 rounded border border-slate-200 bg-slate-50/80 p-3">
            <label className={labelClass}>
              Recibos e comprovantes — imagens e PDF juntos (até 5)
            </label>
            {dados.anexos.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-5">
                {dados.anexos.map((anexo) => (
                  <AnexoSomenteLeitura
                    key={anexo.url}
                    anexo={anexo}
                    onClick={() => onAnexoClick(anexo)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-slate-500">
                Nenhum comprovante anexado.
              </p>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onEditar}
              className="h-10 rounded bg-[#4a90d9] text-[13px] font-normal text-white hover:bg-[#3d7fc4]"
            >
              Editar Despesa
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded border border-slate-300 bg-white text-[13px] font-normal text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(conteudo, document.body);
}

export type { LancamentoDespesaDetalhe };
