"use client";

import { X } from "lucide-react";
import {
  formatarPercentualCurvaAbc,
  type SecaoCurvaAbc,
} from "@/lib/curva-abc-clientes";

function formatarValorColuna(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Props = {
  aberto: boolean;
  titulo: string;
  colunaNome: string;
  mensagemVazia: string;
  secao: SecaoCurvaAbc | null;
  onFechar: () => void;
};

export function ModalCurvaAbcDetalheDashboard({
  aberto,
  titulo,
  colunaNome,
  mensagemVazia,
  secao,
  onFechar,
}: Props) {
  if (!aberto) return null;

  const linhas = secao?.linhas ?? [];

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/45 p-4 pt-16">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#374151]">{titulo}</h2>
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
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#f3f4f6] text-[#6b7280]">
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  {colunaNome}
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                  %
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody className="text-[#374151]">
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-[#9ca3af]">
                    {mensagemVazia}
                  </td>
                </tr>
              ) : (
                linhas.map((linha) => (
                  <tr key={linha.cliente} className="border-b border-[#f3f4f6]">
                    <td className="px-3 py-2.5 text-left">{linha.cliente}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatarPercentualCurvaAbc(linha.percentual)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatarValorColuna(linha.valor)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {linhas.length > 0 && secao && (
              <tfoot>
                <tr className="border-t border-[#e5e7eb] bg-[#fafafa] font-semibold text-[#374151]">
                  <td className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide">
                    Subtotal
                  </td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatarValorColuna(secao.subtotal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
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
  );
}
