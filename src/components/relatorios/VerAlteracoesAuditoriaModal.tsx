"use client";

import { X } from "lucide-react";
import {
  formatarValorCampoLog,
  rotuloOpcaoLog,
  textoClienteLog,
  textoServicoLog,
  type LogAuditoriaLinha,
} from "@/lib/logs-auditoria-core";

type Props = {
  linha: LogAuditoriaLinha | null;
  onFechar: () => void;
};

export function VerAlteracoesAuditoriaModal({ linha, onFechar }: Props) {
  if (!linha) return null;

  const detalhes = linha.detalhes?.length
    ? linha.detalhes
    : [
        {
          campo: "Registro",
          antes: "—",
          depois: linha.tipoAlteracaoLabel,
        },
      ];

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/45 p-4 pt-16">
      <div className="w-full max-w-lg overflow-hidden rounded-sm border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e7eb] dark:border-slate-700 bg-[#f9fafb] dark:bg-slate-800/70 px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-[#374151] dark:text-slate-200">
            {linha ? rotuloOpcaoLog(linha.tipoAlteracao) : "Detalhes"}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded p-1 text-[#9ca3af] dark:text-slate-500 hover:bg-[#f3f4f6] dark:hover:bg-slate-700 dark:bg-slate-800 hover:text-[#374151] dark:text-slate-200"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4 text-[12px] text-[#374151] dark:text-slate-200">
          <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6b7280] dark:text-slate-400">
            <p>
              <span className="font-semibold text-[#374151] dark:text-slate-200">OS:</span>{" "}
              {linha.numeroOs ?? "—"}
            </p>
            <p>
              <span className="font-semibold text-[#374151] dark:text-slate-200">Serviço:</span>{" "}
              {textoServicoLog(linha)}
            </p>
            <p>
              <span className="font-semibold text-[#374151] dark:text-slate-200">Cliente:</span>{" "}
              {textoClienteLog(linha)}
            </p>
            <p>
              <span className="font-semibold text-[#374151] dark:text-slate-200">Usuário:</span> {linha.usuarioNome}
            </p>
            <p className="col-span-2">
              <span className="font-semibold text-[#374151] dark:text-slate-200">Data:</span>{" "}
              {linha.dataAlteracaoFormatada}
            </p>
          </div>
          <table className="w-full border-collapse border border-[#e5e7eb] dark:border-slate-700 text-[11px]">
            <thead>
              <tr className="bg-[#f3f4f6] dark:bg-slate-950 text-[#6b7280] dark:text-slate-400">
                <th className="border border-[#e5e7eb] dark:border-slate-700 px-2 py-2 text-left font-semibold uppercase">
                  Campo
                </th>
                <th className="border border-[#e5e7eb] dark:border-slate-700 px-2 py-2 text-left font-semibold uppercase">
                  Antes
                </th>
                <th className="border border-[#e5e7eb] dark:border-slate-700 px-2 py-2 text-left font-semibold uppercase">
                  Depois
                </th>
              </tr>
            </thead>
            <tbody>
              {detalhes.map((d, i) => (
                <tr key={`${d.campo}-${i}`} className="odd:bg-white dark:bg-slate-900 even:bg-[#fafafa] dark:bg-slate-800/70">
                  <td className="border border-[#e5e7eb] dark:border-slate-700 px-2 py-2">{d.campo}</td>
                  <td className="border border-[#e5e7eb] dark:border-slate-700 px-2 py-2 text-[#6b7280] dark:text-slate-400">
                    {formatarValorCampoLog(d.campo, d.antes)}
                  </td>
                  <td className="border border-[#e5e7eb] dark:border-slate-700 px-2 py-2">
                    {formatarValorCampoLog(d.campo, d.depois)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[#e5e7eb] dark:border-slate-700 px-4 py-3 text-right">
          <button
            type="button"
            onClick={onFechar}
            className="inline-flex h-[32px] items-center rounded-sm border border-[#d1d5db] dark:border-slate-600 bg-white dark:bg-slate-900 px-4 text-[12px] text-[#374151] dark:text-slate-200 hover:bg-[#f9fafb] dark:bg-slate-800/70"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
