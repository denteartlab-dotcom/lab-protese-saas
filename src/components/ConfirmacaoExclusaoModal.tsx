"use client";

import { useRef } from "react";
import { X } from "lucide-react";

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
  labelConfirmar = "Sim",
  labelCancelar = "Não",
}: Props) {
  const confirmandoRef = useRef(false);

  if (!open) return null;

  function handleConfirmar() {
    if (processando || confirmandoRef.current) return;
    confirmandoRef.current = true;
    const action = onConfirm;
    onClose();
    void Promise.resolve(action())
      .catch((err) => {
        console.error("[ConfirmacaoExclusaoModal]", err);
        alert(
          err instanceof Error
            ? err.message
            : "Não foi possível concluir a operação. Tente novamente."
        );
      })
      .finally(() => {
        confirmandoRef.current = false;
      });
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmacao-exclusao-titulo"
        className="relative w-full max-w-md overflow-visible rounded-md bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rounded-t bg-slate-50 px-5 py-4">
          <h2
            id="confirmacao-exclusao-titulo"
            className="pr-8 text-base font-medium text-slate-600"
          >
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={processando}
            className="absolute right-[-8px] top-[-3px] flex h-9 w-9 items-center justify-center rounded-md bg-white text-3xl leading-none text-slate-500 shadow-md hover:bg-slate-50 disabled:opacity-60"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="border-y border-slate-100 px-5 py-5 text-sm leading-relaxed text-slate-600">
          <p className="whitespace-pre-line">{mensagem}</p>
          {aviso ? <p className="mt-2">{aviso}</p> : null}
          {detalhe ? <p className="mt-2 text-slate-500">{detalhe}</p> : null}
        </div>

        <div className="flex justify-end gap-3 rounded-b bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={processando}
            className="h-10 rounded-md border border-slate-300 bg-white px-8 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {labelCancelar}
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={processando}
            className={
              tipoConfirmacao === "primario"
                ? "h-10 rounded-md bg-[#4a90d9] px-8 text-sm font-semibold text-white hover:bg-[#3d7fc4] disabled:opacity-60"
                : "h-10 rounded-md bg-red-500 px-8 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
            }
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
