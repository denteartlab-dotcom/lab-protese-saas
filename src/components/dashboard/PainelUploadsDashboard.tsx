"use client";

import Link from "next/link";
import {
  formatarTamanhoMbCard,
  type UploadsResumoArmazenamento,
} from "@/lib/uploads-armazenamento";
import { cn } from "@/lib/utils";

export type UploadsResumoUi = UploadsResumoArmazenamento;

export function PainelUploadsDashboard({
  titulo,
  resumo,
}: {
  titulo: string;
  resumo: UploadsResumoUi;
  onResumoAtualizado?: () => void;
}) {
  const usado = Math.max(0, Math.min(100, resumo.percentualUsado));
  const textoUsado = formatarTamanhoMbCard(resumo.bytesUsados);
  const textoLivre = formatarTamanhoMbCard(resumo.bytesLivres);
  const galeriaEsgotada = resumo.bytesLivres <= 0;

  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-10 items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-medium text-slate-700">{titulo}</h2>
        <span className="text-[11px] font-semibold text-slate-600">
          {resumo.limiteGb} GB
        </span>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-500">
            <span className="font-semibold text-sky-700">Usado: {textoUsado}</span>
            <span className="mx-1 text-slate-300">·</span>
            <span className={galeriaEsgotada ? "font-semibold text-red-600" : ""}>
              Livre: {textoLivre}
            </span>
          </span>
          <Link
            href="/app/liberar-espaco"
            className="shrink-0 font-medium text-[#4a90d9] hover:underline"
          >
            Liberar espaço
          </Link>
        </div>
        <div className="mb-4 flex gap-4 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Usado
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Livre
          </span>
        </div>
        <div className="relative h-16 overflow-hidden rounded bg-emerald-400">
          {usado > 0 && (
            <div
              className={cn(
                "absolute inset-y-0 left-0 transition-all duration-300",
                galeriaEsgotada ? "bg-red-500" : "bg-sky-500"
              )}
              style={{ width: `${usado}%` }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-sm">
            {usado}%
          </div>
        </div>
        {galeriaEsgotada ? (
          <p className="mt-2 text-[11px] font-medium text-red-600">
            Espaço esgotado — novos uploads estão bloqueados.{" "}
            <Link href="/app/liberar-espaco" className="text-[#4a90d9] hover:underline">
              Liberar espaço
            </Link>{" "}
            para excluir arquivos.
          </p>
        ) : null}
        <div className="mt-3 flex justify-between text-[10px] text-slate-400">
          {[0, 20, 40, 60, 80, 100].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
