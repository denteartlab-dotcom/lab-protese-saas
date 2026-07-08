"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tons = {
  indigo: { icon: "bg-indigo-50 text-indigo-600", valor: "text-slate-900" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", valor: "text-slate-900" },
  amber: { icon: "bg-amber-50 text-amber-600", valor: "text-slate-900" },
  rose: { icon: "bg-rose-50 text-rose-600", valor: "text-slate-900" },
} as const;

export function DisparosMetricCard({
  titulo,
  valor,
  subtitulo,
  icon: Icon,
  tom = "indigo",
}: {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  icon: LucideIcon;
  tom?: keyof typeof tons;
}) {
  const estilo = tons[tom];
  return (
    <div className="flex h-full min-h-[118px] flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{titulo}</p>
        <div className={cn("rounded-lg p-2", estilo.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className={cn("text-2xl font-bold tracking-tight", estilo.valor)}>{valor}</p>
        {subtitulo ? <p className="mt-0.5 text-[11px] text-slate-400">{subtitulo}</p> : null}
      </div>
    </div>
  );
}
