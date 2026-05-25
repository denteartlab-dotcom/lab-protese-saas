"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { dateToBrShort, formatDateBr, parseBrDate } from "@/lib/datas-br";
import { cn } from "@/lib/utils";

const MESES_PT_BR = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA_PT_BR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function diasDoMes(mesCalendario: Date) {
  const year = mesCalendario.getFullYear();
  const month = mesCalendario.getMonth();
  const primeiroDia = new Date(year, month, 1).getDay();
  const totalDias = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: primeiroDia }, () => null),
    ...Array.from({ length: totalDias }, (_, index) => new Date(year, month, index + 1)),
  ];
}

export function CampoDataBr({
  label,
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  calendarPosition = "absolute",
  className,
  inputClassName,
  onValueChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  calendarPosition?: "absolute" | "relative";
  className?: string;
  inputClassName?: string;
  /** Chamado após alterar o valor (digitação, seleção ou limpar). */
  onValueChange?: (value: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(new Date());

  function aplicarValor(novo: string) {
    onChange(novo);
    onValueChange?.(novo);
  }

  function abrirCalendario() {
    const date = parseBrDate(value);
    setMesCalendario(date || new Date());
    setAberto((atual) => !atual);
  }

  function selecionarData(date: Date) {
    aplicarValor(dateToBrShort(date));
    setAberto(false);
  }

  function limparData() {
    aplicarValor("");
    setAberto(false);
  }

  const dataSelecionada = parseBrDate(value);

  return (
    <div className={cn("relative space-y-1", className)}>
      {label ? (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      ) : null}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => aplicarValor(formatDateBr(e.target.value))}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20",
            "pr-9",
            inputClassName
          )}
        />
        <button
          type="button"
          onClick={abrirCalendario}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-600"
          title="Abrir calendário"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
      {aberto && (
        <div
          className={cn(
            "z-50 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-xl",
            calendarPosition === "relative" ? "relative mt-2" : "absolute top-full mt-1"
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1, 1))
              }
              className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
            >
              ‹
            </button>
            <strong className="text-xs text-slate-700">
              {MESES_PT_BR[mesCalendario.getMonth()]} {mesCalendario.getFullYear()}
            </strong>
            <button
              type="button"
              onClick={() =>
                setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1))
              }
              className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">
            {DIAS_SEMANA_PT_BR.map((dia) => (
              <span key={dia}>{dia}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {diasDoMes(mesCalendario).map((date, index) =>
              date ? (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => selecionarData(date)}
                  className={cn(
                    "rounded px-2 py-1 text-xs hover:bg-primary-50 hover:text-primary-700",
                    dataSelecionada &&
                      date.toDateString() === dataSelecionada.toDateString()
                      ? "bg-primary-100 font-semibold text-primary-800"
                      : "text-slate-700"
                  )}
                >
                  {date.getDate()}
                </button>
              ) : (
                <span key={`empty-${index}`} />
              )
            )}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={limparData}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Limpar data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
