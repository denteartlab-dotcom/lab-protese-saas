"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useI18n } from "@/components/i18n-provider";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  exigeParcelamento,
  normalizarParcelas,
  parseListaCondicoesPagamento,
  rotuloCondicoesPagamento,
  type CondicoesPagamentoOrcamento,
} from "@/lib/orcamentos-pagamento";
import { totalLiquido, type Orcamento } from "@/lib/orcamentos";
import { formatCurrency } from "@/lib/utils";

export type PagamentoAprovacaoEscolhido = CondicoesPagamentoOrcamento;

type Props = {
  open: boolean;
  orcamento: Orcamento | null;
  processando?: boolean;
  onClose: () => void;
  onConfirm: (pagamento: PagamentoAprovacaoEscolhido) => void | Promise<void>;
};

type ModoPagamento = "a_vista" | "parcelado";

function sugerirDoFornecedor(orcamento: Orcamento | null): {
  modo: ModoPagamento;
  formaParcelada: "boleto" | "cartao_credito";
  parcelas: number;
} {
  const lista = parseListaCondicoesPagamento(orcamento?.condicoesPagamento);
  const parcelada = lista.find((c) => exigeParcelamento(c.forma));
  if (parcelada) {
    return {
      modo: "parcelado",
      formaParcelada:
        parcelada.forma === "cartao_credito" ? "cartao_credito" : "boleto",
      parcelas: normalizarParcelas(parcelada.parcelas),
    };
  }
  return { modo: "a_vista", formaParcelada: "boleto", parcelas: 2 };
}

export function OrcamentoAprovarModal({
  open,
  orcamento,
  processando = false,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const sugestao = useMemo(() => sugerirDoFornecedor(orcamento), [orcamento]);
  const [modo, setModo] = useState<ModoPagamento>(sugestao.modo);
  const [formaParcelada, setFormaParcelada] = useState<
    "boleto" | "cartao_credito"
  >(sugestao.formaParcelada);
  const [parcelas, setParcelas] = useState(sugestao.parcelas);

  useEffect(() => {
    if (!open || !orcamento) return;
    const s = sugerirDoFornecedor(orcamento);
    setModo(s.modo);
    setFormaParcelada(s.formaParcelada);
    setParcelas(s.parcelas);
  }, [open, orcamento]);

  if (!open || !orcamento) return null;

  const condicao: PagamentoAprovacaoEscolhido =
    modo === "a_vista"
      ? { forma: "a_vista", parcelas: 1 }
      : {
          forma: formaParcelada,
          parcelas: normalizarParcelas(parcelas),
        };

  const resumoPagamento = rotuloCondicoesPagamento(condicao);
  const total = formatCurrency(totalLiquido(orcamento));
  const ofertasFornecedor = parseListaCondicoesPagamento(
    orcamento.condicoesPagamento
  );

  function handleConfirmar() {
    if (processando) return;
    void onConfirm(condicao);
  }

  return (
    <I18nPortal>
      <div
        className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/45 p-4"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="orcamento-aprovar-titulo"
          className="relative w-full max-w-md overflow-visible rounded-md bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-t bg-slate-50 px-5 py-4">
            <h2
              id="orcamento-aprovar-titulo"
              className="pr-8 text-base font-medium text-slate-600"
            >
              {t("estoque.orcamentos.confirm.aprovarTitulo")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={processando}
              className="absolute right-[-8px] top-[-3px] flex h-9 w-9 items-center justify-center rounded-md bg-white text-slate-500 shadow-md hover:bg-slate-50 disabled:opacity-60"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="space-y-4 border-y border-slate-100 px-5 py-5 text-sm text-slate-600">
            <p>
              {t("estoque.orcamentos.confirm.aprovarMensagem", {
                numero: orcamento.numeroPedido,
              })}
            </p>
            <p className="text-slate-500">
              {orcamento.fornecedorNome || t("estoque.orcamentos.fornecedorPadrao")}{" "}
              · {total}
            </p>

            {ofertasFornecedor.length > 0 && (
              <div className="rounded-sm border border-slate-100 bg-slate-50 px-3 py-2 text-[11px]">
                <p className="mb-1 font-medium text-slate-700">
                  {t("estoque.orcamentos.confirm.aprovarOfertasFornecedor")}
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-slate-600">
                  {ofertasFornecedor.map((c, i) => (
                    <li key={c.id || i}>{rotuloCondicoesPagamento(c)}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t("estoque.orcamentos.confirm.aprovarEscolherPagamento")}
              </p>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-slate-200 px-3 py-2 hover:bg-slate-50">
                  <input
                    type="radio"
                    name="modo-pagamento-aprovacao"
                    checked={modo === "a_vista"}
                    onChange={() => setModo("a_vista")}
                    disabled={processando}
                    className="accent-[#4a90d9]"
                  />
                  <span>{t("estoque.orcamentos.confirm.aprovarAVista")}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-slate-200 px-3 py-2 hover:bg-slate-50">
                  <input
                    type="radio"
                    name="modo-pagamento-aprovacao"
                    checked={modo === "parcelado"}
                    onChange={() => setModo("parcelado")}
                    disabled={processando}
                    className="accent-[#4a90d9]"
                  />
                  <span>{t("estoque.orcamentos.confirm.aprovarParcelado")}</span>
                </label>
              </div>
            </div>

            {modo === "parcelado" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
                    {t("estoque.orcamentos.confirm.aprovarForma")}
                  </label>
                  <select
                    value={formaParcelada}
                    disabled={processando}
                    onChange={(e) =>
                      setFormaParcelada(
                        e.target.value as "boleto" | "cartao_credito"
                      )
                    }
                    className="h-9 w-full rounded-sm border border-slate-200 px-2 text-[11px]"
                  >
                    <option value="boleto">
                      {t("estoque.orcamentos.pagamento.boleto")}
                    </option>
                    <option value="cartao_credito">
                      {t("estoque.orcamentos.pagamento.cartao_credito")}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
                    {t("estoque.orcamentos.confirm.aprovarParcelas")}
                  </label>
                  <select
                    value={parcelas}
                    disabled={processando}
                    onChange={(e) => setParcelas(Number(e.target.value))}
                    className="h-9 w-full rounded-sm border border-slate-200 px-2 text-[11px]"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}x
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="rounded-sm border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              <p className="font-medium">
                {t("estoque.orcamentos.confirm.aprovarResumoTitulo")}
              </p>
              <p className="mt-1">
                {t("estoque.orcamentos.confirm.aprovarResumoTexto", {
                  pagamento: resumoPagamento,
                  total,
                })}
              </p>
            </div>

            <p className="text-[11px] text-slate-500">
              {t("estoque.orcamentos.confirm.aprovarAviso")}
            </p>
          </div>

          <div className="flex justify-end gap-3 rounded-b bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={processando}
              className="h-10 rounded-md border border-slate-300 bg-white px-8 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              {t("estoque.orcamentos.confirm.nao")}
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={processando}
              className="h-10 rounded-md bg-[#4a90d9] px-8 text-sm font-semibold text-white hover:bg-[#3d7fc4] disabled:opacity-60"
            >
              {processando
                ? t("estoque.orcamentos.confirm.aprovando")
                : t("estoque.orcamentos.confirm.sim")}
            </button>
          </div>
        </div>
      </div>
    </I18nPortal>
  );
}

