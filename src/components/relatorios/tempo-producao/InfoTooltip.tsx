"use client";

import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  texto: string;
  className?: string;
  lado?: "top" | "bottom";
};

export function InfoTooltip({ texto, className, lado = "top" }: Props) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      <HelpCircle className="h-3.5 w-3.5 cursor-help text-slate-400 transition hover:text-primary-500 dark:text-slate-500 dark:hover:text-primary-400" />
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-normal leading-snug text-slate-600 shadow-lg group-hover:block dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
          lado === "top" ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2" : "top-full left-1/2 mt-1.5 -translate-x-1/2"
        )}
      >
        {texto}
      </span>
    </span>
  );
}
