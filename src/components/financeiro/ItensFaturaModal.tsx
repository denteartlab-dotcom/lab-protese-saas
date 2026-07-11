"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { LinhaItemFatura } from "@/lib/itens-fatura-linhas";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  linhas: LinhaItemFatura[];
};

const thClass =
  "border-b border-[#e5e7eb] bg-[#f5f5f5] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[#6b7280] whitespace-nowrap";
const tdClass = "border-b border-[#f0f0f0] px-3 py-2 text-[11px] text-[#374151]";

function badgeSituacao(linha: LinhaItemFatura) {
  const entregue = linha.situacaoLabel.toLowerCase() === "entregue";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
        entregue
          ? "bg-[#22c55e] text-white"
          : linha.situacaoClass || "bg-[#e5e7eb] text-[#374151]"
      )}
    >
      {linha.situacaoLabel}
    </span>
  );
}

export function ItensFaturaModal({ open, onClose, linhas }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <I18nPortal>
      <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/40 p-4 pt-20 sm:pt-24">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-[960px] overflow-hidden rounded-md border border-[#e5e7eb] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="itens-fatura-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3">
          <h2 id="itens-fatura-titulo" className="text-[13px] font-normal text-[#6b7280]">
            Itens Fatura
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(72vh,540px)] overflow-auto px-5 pb-5">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr>
                <th className={thClass}>OS</th>
                <th className={thClass}>Data Entregue</th>
                <th className={cn(thClass, "text-center")}>Qtd</th>
                <th className={thClass}>Serviço/Produto</th>
                <th className={thClass}>Dentista</th>
                <th className={thClass}>Paciente</th>
                <th className={cn(thClass, "text-center")}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={7} className={cn(tdClass, "py-10 text-center text-[#9ca3af]")}>
                    Nenhuma OS vinculada a esta fatura.
                  </td>
                </tr>
              ) : (
                linhas.map((linha, index) => (
                  <tr key={`${linha.os}-${index}`} className="bg-white hover:bg-[#fafafa]">
                    <td className={tdClass}>{linha.os}</td>
                    <td className={tdClass}>{linha.dataEntrega}</td>
                    <td className={cn(tdClass, "text-center")}>{linha.qtd}</td>
                    <td className={tdClass}>{linha.servicoProduto}</td>
                    <td className={tdClass}>{linha.dentista}</td>
                    <td className={tdClass}>{linha.paciente}</td>
                    <td className={cn(tdClass, "text-center")}>{badgeSituacao(linha)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </I18nPortal>,
    document.body
  );
}
