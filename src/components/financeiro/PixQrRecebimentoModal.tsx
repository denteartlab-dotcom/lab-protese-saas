"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DadosPixQrRecebimento = {
  valor: number;
  clienteNome?: string;
  pixPayload: string;
  pixEncodedImage: string;
  expirationDate?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  dados: DadosPixQrRecebimento | null;
  money: (value: number) => string;
};

export function PixQrRecebimentoModal({ open, onClose, dados, money }: Props) {
  const [mounted, setMounted] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setCopiado(false);
  }, [open]);

  async function copiarPayload() {
    if (!dados?.pixPayload) return;
    try {
      await navigator.clipboard.writeText(dados.pixPayload);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* ignora */
    }
  }

  if (!open || !mounted || !dados) return null;

  const imgSrc = dados.pixEncodedImage.startsWith("data:")
    ? dados.pixEncodedImage
    : `data:image/png;base64,${dados.pixEncodedImage}`;

  return createPortal(
    <I18nPortal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-sm bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-[#374151]">Pix — QR Code Asaas</h2>
            {dados.clienteNome ? (
              <p className="mt-1 text-[12px] text-[#6b7280]">{dados.clienteNome}</p>
            ) : null}
            <p className="mt-1 text-[14px] font-semibold text-[#16a34a]">{money(dados.valor)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#6b7280]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <img
            src={imgSrc}
            alt="QR Code Pix"
            className="h-52 w-52 rounded border border-[#e5e7eb] bg-white p-2"
          />
          {dados.expirationDate ? (
            <p className="text-center text-[11px] text-[#6b7280]">
              Válido até{" "}
              {new Date(dados.expirationDate).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          ) : null}
          <p className="text-center text-[11px] text-[#6b7280]">
            O recebimento será confirmado automaticamente após o pagamento do Pix.
          </p>
          <button
            type="button"
            onClick={() => void copiarPayload()}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-sm border px-3 py-2 text-[12px] font-medium",
              copiado
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-[#d1d5db] bg-white text-[#374151] hover:bg-[#f9fafb]"
            )}
          >
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Código copiado" : "Copiar Pix Copia e Cola"}
          </button>
        </div>
      </div>
    </div>
    </I18nPortal>,
    document.body
  );
}
