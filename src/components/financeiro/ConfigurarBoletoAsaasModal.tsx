"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { I18nPortal } from "@/components/I18nPortal";
import { CampoDataBr } from "@/components/campo-data-br";
import { useI18n } from "@/components/i18n-provider";
import {
  formatarPercentualInput,
  parsePercentualBr,
  percentualParaInput,
} from "@/lib/asaas-percentual-ui";
import { dateToBrShort } from "@/lib/datas-br";

export type DadosBoletoAsaasEmissao = {
  vencimento: string;
  interest: number;
  fine: number;
};

type Props = {
  open: boolean;
  vencimentoInicial?: string;
  processando?: boolean;
  onClose: () => void;
  onConfirm: (dados: DadosBoletoAsaasEmissao) => void;
};

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

export function ConfigurarBoletoAsaasModal({
  open,
  vencimentoInicial,
  processando = false,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [vencimento, setVencimento] = useState(
    vencimentoInicial || dateToBrShort(new Date())
  );
  const [interest, setInterest] = useState(percentualParaInput(0));
  const [fine, setFine] = useState(percentualParaInput(0));

  useEffect(() => {
    if (!open) return;
    setVencimento(vencimentoInicial || dateToBrShort(new Date()));
    setInterest(percentualParaInput(0));
    setFine(percentualParaInput(0));
  }, [open, vencimentoInicial]);

  if (!open) return null;

  return (
    <I18nPortal>
      <div
        className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/45 p-4"
        onClick={() => {
          if (!processando) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="configurar-boleto-asaas-titulo"
          className="relative w-full max-w-md overflow-visible rounded-md bg-white shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="rounded-t bg-slate-50 px-5 py-4 dark:bg-slate-800">
            <h2
              id="configurar-boleto-asaas-titulo"
              className="pr-8 text-base font-medium text-slate-600 dark:text-slate-200"
            >
              {t("financeiro.conta.digital.boletos.emitirTitulo")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={processando}
              className="absolute right-[-8px] top-[-3px] flex h-9 w-9 items-center justify-center rounded-md bg-white text-slate-500 shadow-md hover:bg-slate-50 disabled:opacity-60 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              aria-label={t("financeiro.conta.digital.boletos.cancelarModal")}
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="space-y-3 border-y border-slate-100 px-5 py-5 dark:border-slate-800">
            <p className="text-[12px] leading-relaxed text-slate-600">
              {t("financeiro.conta.digital.boletos.emitirAjuda")}
            </p>
            <div>
              <label className={labelClass}>
                {t("financeiro.conta.digital.boletos.campoVencimento")}
              </label>
              <CampoDataBr
                value={vencimento}
                onChange={setVencimento}
                className="space-y-0"
                inputClassName={inputClass}
                calendarZIndex={10120}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("financeiro.conta.digital.boletos.campoJuros")}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={interest}
                onChange={(e) => setInterest(formatarPercentualInput(e.target.value))}
                className={inputClass}
                placeholder={t("financeiro.conta.digital.boletos.placeholderPercentual")}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("financeiro.conta.digital.boletos.campoMulta")}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={fine}
                onChange={(e) => setFine(formatarPercentualInput(e.target.value))}
                className={inputClass}
                placeholder={t("financeiro.conta.digital.boletos.placeholderPercentual")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 rounded-b bg-white px-6 py-4 dark:bg-slate-900">
            <button
              type="button"
              onClick={onClose}
              disabled={processando}
              className="h-10 rounded-md border border-slate-300 bg-white px-8 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {t("financeiro.conta.digital.boletos.nao")}
            </button>
            <button
              type="button"
              disabled={processando}
              onClick={() =>
                onConfirm({
                  vencimento,
                  interest: parsePercentualBr(interest),
                  fine: parsePercentualBr(fine),
                })
              }
              className="h-10 rounded-md bg-[#4a90d9] px-8 text-sm font-semibold text-white hover:bg-[#3d7fc4] disabled:opacity-60"
            >
              {t("financeiro.conta.digital.boletos.emitirConfirmar")}
            </button>
          </div>
        </div>
      </div>
    </I18nPortal>
  );
}
