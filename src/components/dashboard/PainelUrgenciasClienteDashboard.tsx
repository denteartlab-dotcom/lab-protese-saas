"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { UrgenteClienteDashboardItem } from "@/lib/urgencia-cliente-util";

type Props = {
  titulo: string;
  lista: UrgenteClienteDashboardItem[];
  labelVisualizar: string;
};

function formatarDataHora(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PainelUrgenciasClienteDashboard({
  titulo,
  lista,
  labelVisualizar,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const total = lista.length;

  return (
    <section className="rounded-lg border border-red-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={cn(
          "flex w-full flex-wrap items-center justify-between gap-3 bg-red-50/60 px-4 py-3 text-left transition hover:bg-red-50/90",
          aberto && "border-b border-red-100"
        )}
        aria-expanded={aberto}
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-red-700 transition-transform",
              aberto && "rotate-180"
            )}
          />
          <div>
            <h2 className="text-sm font-semibold text-red-800">{titulo}</h2>
            <p className="text-[12px] text-red-700/80">
              {total} trabalho{total === 1 ? "" : "s"} urgente{total === 1 ? "" : "s"} sinalizado
              {total === 1 ? "" : "s"} pelo cliente
            </p>
          </div>
        </div>
        <span className="rounded-full bg-red-600 px-3 py-1 text-lg font-bold text-white">
          {total}
        </span>
      </button>

      {aberto ? (
        total === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-slate-500">
            Nenhum trabalho urgente sinalizado pelo cliente no momento.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lista.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12px]"
              >
                <div>
                  <p className="font-semibold text-slate-800">
                    OS {item.numeroOs} · {item.pacienteNome}
                  </p>
                  <p className="text-slate-600">
                    {item.clienteNome} — {item.tipoProtese}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Sinalizado em {formatarDataHora(item.criadoEm)}
                  </p>
                </div>
                {item.linkAcompanhamento ? (
                  <Link
                    href={item.linkAcompanhamento}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-red-300 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {labelVisualizar}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
