"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { hrefOsEditar } from "@/lib/notificacao-links";
import type { UrgenteClienteDashboardItem } from "@/lib/urgencia-cliente";

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
  const [expandido, setExpandido] = useState(false);
  const total = lista.length;
  const visiveis = useMemo(
    () => (expandido ? lista : lista.slice(0, 5)),
    [expandido, lista]
  );

  return (
    <section className="rounded-lg border border-red-200 bg-white shadow-sm lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-red-50/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-red-800">{titulo}</h2>
          <p className="text-[12px] text-red-700/80">
            {total} trabalho{total === 1 ? "" : "s"} urgente{total === 1 ? "" : "s"} sinalizado
            {total === 1 ? "" : "s"} pelo cliente
          </p>
        </div>
        <span className="rounded-full bg-red-600 px-3 py-1 text-lg font-bold text-white">
          {total}
        </span>
      </div>

      {total === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-slate-500">
          Nenhum trabalho urgente sinalizado pelo cliente no momento.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {visiveis.map((item) => (
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
                <Link
                  href={hrefOsEditar(item.trabalhoId)}
                  className="rounded border border-red-300 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                >
                  {labelVisualizar}
                </Link>
              </li>
            ))}
          </ul>
          {lista.length > 5 ? (
            <div className="border-t border-slate-100 px-4 py-2 text-center">
              <button
                type="button"
                onClick={() => setExpandido((v) => !v)}
                className="text-[11px] font-medium text-red-700 hover:underline"
              >
                {expandido ? "Ver menos" : `Ver todos (${lista.length})`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
