"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useI18n } from "@/components/i18n-provider";
import { useEffect } from "react";

type Props = {
  trabalhoId: string;
  onClose: () => void;
  /** Dentro da linha expandida da agenda: sem overlay. */
  embutido?: boolean;
};

export function AgendaEditarOsModal({ trabalhoId, onClose, embutido = false }: Props) {
  const { t } = useI18n();
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "agenda-os-edit-close") {
        onClose();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onClose]);

  const iframe = (
    <iframe
      title="Editar Agenda"
      className="h-full w-full flex-1 border-0"
      src={`/app/producao/controle?editar=${encodeURIComponent(trabalhoId)}&from=agenda&embed=1`}
    />
  );

  if (embutido) {
    return (
      <div className="flex h-[70vh] flex-col border-t border-slate-200 bg-white">
        <div className="flex justify-end border-b border-slate-200 px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {t("common.fechar")}
          </button>
        </div>
        {iframe}
      </div>
    );
  }

  return (
    <I18nPortal>
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-2 md:p-4">
      <div className="flex h-[94vh] w-full max-w-[96vw] flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-xl">
        {iframe}
      </div>
    </div>
    </I18nPortal>
  );
}
