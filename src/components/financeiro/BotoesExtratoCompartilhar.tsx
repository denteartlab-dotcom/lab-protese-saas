"use client";

import { FileSpreadsheet, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onExcel: () => void;
  onWhatsapp: () => void;
  disabled?: boolean;
  processando?: boolean;
  className?: string;
};

/** Excel (borda azul) + WhatsApp (verde) — sem e-mail, conforme Smart Prótese. */
export function BotoesExtratoCompartilhar({
  onExcel,
  onWhatsapp,
  disabled = false,
  processando = false,
  className,
}: Props) {
  const bloqueado = disabled || processando;

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <button
        type="button"
        title="Exportar Excel"
        onClick={onExcel}
        disabled={bloqueado}
        className="flex h-9 w-9 items-center justify-center rounded-sm border border-[#4a90d9] bg-white text-[#4a90d9] hover:bg-[#eff6ff] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FileSpreadsheet className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Enviar por WhatsApp"
        onClick={onWhatsapp}
        disabled={bloqueado}
        className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#25D366] text-white hover:bg-[#1ebe57] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MessageCircle className="h-4 w-4" />
      </button>
    </div>
  );
}
