"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  ARMAZENAMENTO_CHEIO_EVENT,
  MENSAGEM_ARMAZENAMENTO_CHEIO,
} from "@/lib/uploads-erro-armazenamento";

/** Modal global: armazenamento cheio + atalho para Liberar espaço. */
export function ArmazenamentoCheioModalHost() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const abrir = () => setOpen(true);
    window.addEventListener(ARMAZENAMENTO_CHEIO_EVENT, abrir);
    return () => window.removeEventListener(ARMAZENAMENTO_CHEIO_EVENT, abrir);
  }, []);

  if (!open) return null;

  function fechar() {
    setOpen(false);
  }

  function irLiberarEspaco() {
    setOpen(false);
    router.push("/app/liberar-espaco");
  }

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/45 p-4"
      onClick={fechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="armazenamento-cheio-titulo"
        className="relative w-full max-w-md overflow-visible rounded-md bg-white shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-t bg-slate-50 px-5 py-4 dark:bg-slate-800">
          <h2
            id="armazenamento-cheio-titulo"
            className="pr-8 text-base font-medium text-slate-600 dark:text-slate-200"
          >
            {t("armazenamento.cheio.titulo")}
          </h2>
          <button
            type="button"
            onClick={fechar}
            className="absolute right-[-8px] top-[-3px] flex h-9 w-9 items-center justify-center rounded-md bg-white text-3xl leading-none text-slate-500 shadow-md hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            aria-label={t("armazenamento.cheio.fechar")}
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="border-y border-slate-100 px-5 py-5 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <p className="whitespace-pre-line">{t("armazenamento.cheio.mensagem")}</p>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {t("armazenamento.cheio.aviso")}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3 rounded-b bg-white px-6 py-4 dark:bg-slate-900">
          <button
            type="button"
            onClick={fechar}
            className="h-10 rounded-md border border-slate-300 bg-white px-6 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {t("armazenamento.cheio.fechar")}
          </button>
          <button
            type="button"
            onClick={irLiberarEspaco}
            className="h-10 rounded-md bg-[#4a90d9] px-6 text-sm font-semibold text-white hover:bg-[#3d7fc4]"
          >
            {t("armazenamento.cheio.liberarEspaco")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Fallback estático se i18n ainda não tiver a chave. */
export const ARMAZENAMENTO_CHEIO_MSG_FALLBACK = MENSAGEM_ARMAZENAMENTO_CHEIO;
