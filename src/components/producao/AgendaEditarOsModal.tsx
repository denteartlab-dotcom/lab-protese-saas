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
    <div className="fixed inset-0 z-[90] bg-white">
      <iframe
        title="Editar Ordem de Serviço"
        className="h-full w-full border-0"
        src={`/app/producao/controle?editar=${encodeURIComponent(trabalhoId)}&from=agenda&embed=1`}
      />
    </div>
  );
}
