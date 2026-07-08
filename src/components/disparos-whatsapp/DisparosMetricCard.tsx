"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tons = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
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
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{titulo}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{valor}</p>
          {subtitulo ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{subtitulo}</p> : null}
        </div>
        <div className={cn("rounded-lg p-2.5", tons[tom])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
