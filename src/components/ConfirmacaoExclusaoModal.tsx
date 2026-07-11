"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { useTrUi } from "@/lib/i18n/use-tr-ui";

type Props = {
  open: boolean;
  titulo: string;
  mensagem: string;
  /** Texto de atenção abaixo da pergunta (ex.: comissões, créditos). */
  aviso?: string;
  detalhe?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  processando?: boolean;
  /** Botão de confirmação vermelho (exclusão) ou azul (ação). */
  tipoConfirmacao?: "exclusao" | "primario";
  /** Apenas aviso com botão OK (sem Sim/Não). */
  modo?: "confirmacao" | "alerta";
  labelConfirmar?: string;
  labelCancelar?: string;
};

export function ConfirmacaoExclusaoModal({
  open,
  titulo,
  mensagem,
  aviso,
  detalhe,
  onClose,
  onConfirm,
  processando = false,
  tipoConfirmacao = "exclusao",
  modo = "confirmacao",
  labelConfirmar = "Sim",
  labelCancelar = "Não",
}: Props) {
  const { tr } = useTrUi();
  const confirmandoRef = useRef(false);

  if (!open) return null;

  function handleConfirmar() {
    if (processando || confirmandoRef.current) return;
    if (modo === "alerta") {
      onClose();
      return;
    }
    confirmandoRef.current = true;
    const action = onConfirm;
    onClose();
    void Promise.resolve(action())
      .catch((err) => {
        console.error("[ConfirmacaoExclusaoModal]", err);
        alert(
          err instanceof Error
            ? tr(err.message)
            : tr("Não foi possível concluir a operação. Tente novamente.")
        );
      })
      .finally(() => {
        confirmandoRef.current = false;
      });
  }

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmacao-exclusao-titulo"
        className="relative w-full max-w-md overflow-visible rounded-md bg-white shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rounded-t bg-slate-50 px-5 py-4 dark:bg-slate-800">
          <h2
            id="confirmacao-exclusao-titulo"
            className="pr-8 text-base font-medium text-slate-600 dark:text-slate-200"
          >
            {tr(titulo)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={processando}
            className="absolute right-[-8px] top-[-3px] flex h-9 w-9 items-center justify-center rounded-md bg-white text-3xl leading-none text-slate-500 shadow-md hover:bg-slate-50 disabled:opacity-60 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            aria-label={tr("Fechar")}
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="border-y border-slate-100 px-5 py-5 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <p className="whitespace-pre-line">{tr(mensagem)}</p>
          {aviso ? <p className="mt-2">{tr(aviso)}</p> : null}
          {detalhe ? <p className="mt-2 text-slate-500 dark:text-slate-400">{tr(detalhe)}</p> : null}
        </div>

        <div className="flex justify-end gap-3 rounded-b bg-white px-6 py-4 dark:bg-slate-900">
          {modo === "confirmacao" ? (
            <button
              type="button"
              onClick={onClose}
              disabled={processando}
              className="h-10 rounded-md border border-slate-300 bg-white px-8 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {tr(labelCancelar)}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={processando}
            className={
              modo === "alerta" || tipoConfirmacao === "primario"
                ? "h-10 rounded-md bg-[#4a90d9] px-8 text-sm font-semibold text-white hover:bg-[#3d7fc4] disabled:opacity-60"
                : "h-10 rounded-md bg-red-500 px-8 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
            }
          >
            {modo === "alerta" ? tr("OK") : tr(labelConfirmar)}
          </button>
        </div>
      </div>
    </div>
  );
}
