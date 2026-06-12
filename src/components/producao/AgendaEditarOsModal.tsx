"use client";

import { useEffect } from "react";

type Props = {
  trabalhoId: string;
  onClose: () => void;
};

export function AgendaEditarOsModal({ trabalhoId, onClose }: Props) {
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "agenda-os-edit-close") {
        onClose();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-2 md:p-4">
      <div className="flex h-[94vh] w-full max-w-[96vw] flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-xl">
        <iframe
          title="Editar Agenda"
          className="h-full w-full flex-1 border-0"
          src={`/app/producao/controle?editar=${encodeURIComponent(trabalhoId)}&from=agenda&embed=1`}
        />
      </div>
    </div>
  );
}
