"use client";

import Link from "next/link";
import {
  formatarTamanhoMbCard,
  LIMITE_ARMAZENAMENTO_BYTES,
  type UploadsResumoArmazenamento,
} from "@/lib/uploads-armazenamento";
import { cn } from "@/lib/utils";

export type UploadsResumoUi = UploadsResumoArmazenamento;

function percentualUsadoBarra(resumo: UploadsResumoUi) {
  const limite = resumo.limiteBytes ?? LIMITE_ARMAZENAMENTO_BYTES;
  if (limite <= 0 || resumo.bytesUsados <= 0) return 0;
  return Math.min(100, (resumo.bytesUsados / limite) * 100);
}

function rotuloPercentualUsado(resumo: UploadsResumoUi) {
  const pct = percentualUsadoBarra(resumo);
  if (resumo.bytesUsados <= 0) return "0";
  if (pct < 1) return (Math.round(pct * 10) / 10).toLocaleString("pt-BR");
  return String(Math.round(pct));
}

export function PainelUploadsDashboard({
  titulo,
  resumo,
}: {
  titulo: string;
  resumo: UploadsResumoUi;
  onResumoAtualizado?: () => void;
}) {
  const limiteBytes = resumo.limiteBytes ?? LIMITE_ARMAZENAMENTO_BYTES;
  const bytesLivres = Math.max(0, limiteBytes - resumo.bytesUsados);
  const pctUsado = percentualUsadoBarra(resumo);
  const textoPercentual = rotuloPercentualUsado(resumo);
  const textoUsado = formatarTamanhoMbCard(resumo.bytesUsados);
  const textoLivre = formatarTamanhoMbCard(bytesLivres);
  const galeriaEsgotada = bytesLivres <= 0;

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
        <div className="relative flex h-16 overflow-hidden rounded">
          <div
            className={cn(
              "shrink-0 transition-all duration-300",
              galeriaEsgotada ? "bg-red-500" : "bg-sky-500"
            )}
            style={{
              width: `${pctUsado}%`,
              minWidth: resumo.bytesUsados > 0 ? 4 : 0,
            }}
          />
          <div className="min-w-0 flex-1 bg-emerald-400 transition-all duration-300" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-sm">
            {textoPercentual}%
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
