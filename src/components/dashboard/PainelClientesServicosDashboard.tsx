"use client";

import Link from "next/link";
import {
  OPCOES_DIAS_SEM_SERVICO,
  type ClienteSemServicoItem,
} from "@/lib/dashboard-clientes-servico";
import { formatDate } from "@/lib/utils";

export function PainelClientesServicosDashboard({
  titulo,
  lista,
  diasMinimos,
  onDiasChange,
}: {
  titulo: string;
  lista: ClienteSemServicoItem[];
  diasMinimos: number;
  onDiasChange: (dias: number) => void;
}) {
  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-10 items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-medium text-slate-700">{titulo}</h2>
        <select
          value={String(diasMinimos)}
          onChange={(e) => onDiasChange(Number(e.target.value))}
          className="h-6 max-w-[88px] rounded border border-slate-200 bg-white px-1.5 text-[10px] text-slate-600"
          aria-label="Dias sem serviço"
        >
          {OPCOES_DIAS_SEM_SERVICO.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>
      <div className="p-4">
        <p className="mb-3 text-[11px] text-slate-500">
          Não solicita serviço há mais de {diasMinimos} dias
        </p>
        <div className="mb-1 grid grid-cols-[1fr_auto] gap-2 border-b border-slate-100 pb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          <span>Cliente</span>
          <span>último serviço</span>
        </div>
        <div className="max-h-36 space-y-0 overflow-y-auto">
          {lista.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-slate-400">
              Nenhum cliente inativo neste período.
            </p>
          ) : (
            lista.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_auto] gap-2 border-b border-slate-50 py-2 last:border-0"
              >
                <Link
                  href={`/app/clientes`}
                  className="truncate font-medium text-slate-700 hover:text-primary-600"
                >
                  {c.nome}
                </Link>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {c.ultimoServicoEm ? formatDate(c.ultimoServicoEm) : "—"}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Link
            href="/app/clientes"
            className="rounded border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-medium text-primary-700 hover:bg-primary-100"
          >
            Ver Mais
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Imprimir
          </button>
        </div>
      </div>
    </section>
  );
}
