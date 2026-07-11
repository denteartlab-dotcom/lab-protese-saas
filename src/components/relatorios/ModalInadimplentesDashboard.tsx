"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { X } from "lucide-react";
import type { FaturaInadimplente } from "@/lib/dashboard-financeiro";
import { formatarMoedaResumo } from "@/lib/dashboard-gerencial";

type Props = {
  aberto: boolean;
  faturas: FaturaInadimplente[];
  onFechar: () => void;
};

export function ModalInadimplentesDashboard({ aberto, faturas, onFechar }: Props) {
  if (!aberto) return null;

  return (
    <I18nPortal>
      <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/45 p-4 pt-16">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#374151]">
            Inadimplentes — faturas em aberto
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-auto p-4">
          {faturas.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#9ca3af]">
              Nenhuma fatura inadimplente no momento.
            </p>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f3f4f6] text-[#6b7280]">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase">
                    Cliente
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase">
                    OS
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase">
                    Vencimento
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((fatura) => (
                  <tr key={fatura.id} className="border-t border-[#f3f4f6]">
                    <td className="px-3 py-2.5 text-[#374151]">{fatura.clienteNome}</td>
                    <td className="px-3 py-2.5 text-[#374151]">
                      {fatura.numeroOs ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[#6b7280]">{fatura.dataFormatada}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-[#c62828]">
                      {formatarMoedaResumo(fatura.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-[#e5e7eb] px-4 py-3 text-right">
          <button
            type="button"
            onClick={onFechar}
            className="inline-flex h-[32px] items-center rounded-sm border border-[#d1d5db] bg-white px-4 text-[12px] text-[#374151] hover:bg-[#f9fafb]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
    </I18nPortal>
  );
}
