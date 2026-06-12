"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const ALTURA_CALENDARIO_ESTIMADA = 320;

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

type PosicaoCalendario = {
  top: number;
  left: number;
};

function calcularPosicaoCalendario(anchor: HTMLElement): PosicaoCalendario {
  const rect = anchor.getBoundingClientRect();
  const espacoAbaixo = window.innerHeight - rect.bottom;
  const abrirAcima =
    espacoAbaixo < ALTURA_CALENDARIO_ESTIMADA &&
    rect.top > ALTURA_CALENDARIO_ESTIMADA;

  const larguraCalendario = 256;
  let left = rect.left;
  if (left + larguraCalendario > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - larguraCalendario - 8);
  }

  const top = abrirAcima
    ? rect.top - ALTURA_CALENDARIO_ESTIMADA - 6
    : rect.bottom + 6;

  return { top, left };
}

export function CampoDataBr({
  label,
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  calendarPosition = "absolute",
  iconPosition = "right",
  className,
  inputClassName,
  onValueChange,
  disabled = false,
  calendarZIndex = 9999,
  onCalendarOpenChange,
  forceClose = false,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  calendarPosition?: "absolute" | "relative";
  /** Ícone do calendário à esquerda (relatórios Smart) ou à direita (padrão). */
  iconPosition?: "left" | "right";
  className?: string;
  inputClassName?: string;
  /** Chamado após alterar o valor (digitação, seleção ou limpar). */
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  /** z-index do painel do calendário em portal (acima de modais). */
  calendarZIndex?: number;
  onCalendarOpenChange?: (open: boolean) => void;
  /** Fecha o calendário quando outro campo de data abre no mesmo formulário. */
  forceClose?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(new Date());
  const [posicao, setPosicao] = useState<PosicaoCalendario | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const usarPortal = calendarPosition === "absolute";

  function aplicarValor(novo: string) {
    onChange(novo);
    onValueChange?.(novo);
  }

  const atualizarPosicao = useCallback(() => {
    if (!anchorRef.current) return;
    setPosicao(calcularPosicaoCalendario(anchorRef.current));
  }, []);

  function definirAberto(proximo: boolean) {
    setAberto(proximo);
    onCalendarOpenChange?.(proximo);
  }

  function abrirCalendario() {
    const date = parseBrDate(value);
    setMesCalendario(date || new Date());
    if (!aberto) {
      atualizarPosicao();
      definirAberto(true);
    } else {
      definirAberto(false);
    }
  }

  useEffect(() => {
    if (forceClose && aberto) definirAberto(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a forceClose
  }, [forceClose]);

  useEffect(() => {
    if (!aberto || !usarPortal) return;
    atualizarPosicao();
    window.addEventListener("resize", atualizarPosicao);
    window.addEventListener("scroll", atualizarPosicao, true);
    return () => {
      window.removeEventListener("resize", atualizarPosicao);
      window.removeEventListener("scroll", atualizarPosicao, true);
    };
  }, [aberto, usarPortal, atualizarPosicao]);

  function selecionarData(date: Date) {
    aplicarValor(dateToBrShort(date));
    definirAberto(false);
  }

  function limparData() {
    aplicarValor("");
    definirAberto(false);
  }

  const zPainel = calendarZIndex;
  const zBackdrop = calendarZIndex - 1;

  const dataSelecionada = parseBrDate(value);

  const painelCalendario = (
    <div className="w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
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
  );

  return (
    <div className={cn("relative space-y-1", className)}>
      {label ? (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      ) : null}
      <div ref={anchorRef} className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(e) => aplicarValor(formatDateBr(e.target.value))}
          onBlur={() => {
            const parsed = parseBrDate(value);
            if (parsed) aplicarValor(formatDateBr(value));
          }}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20",
            disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
            inputClassName,
            iconPosition === "left" ? "pl-8 pr-2" : "pr-9"
          )}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={abrirCalendario}
          className={cn(
            "absolute top-1/2 z-[1] -translate-y-1/2 text-slate-400 hover:text-primary-600",
            iconPosition === "left" ? "left-2" : "right-3",
            disabled && "pointer-events-none opacity-40"
          )}
          title="Abrir calendário"
          aria-label="Abrir calendário"
          aria-expanded={aberto}
        >
          <CalendarDays className="h-3.5 w-3.5" />
        </button>
      </div>
      {aberto &&
        (usarPortal && typeof document !== "undefined" && posicao
          ? createPortal(
              <>
                <button
                  type="button"
                  className="fixed inset-0 cursor-default bg-transparent"
                  style={{ zIndex: zBackdrop }}
                  aria-label="Fechar calendário"
                  onClick={() => definirAberto(false)}
                />
                <div
                  className="fixed"
                  style={{ top: posicao.top, left: posicao.left, zIndex: zPainel }}
                  role="dialog"
                  aria-label="Calendário"
                >
                  {painelCalendario}
                </div>
              </>,
              document.body
            )
          : !usarPortal && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[89]"
                  aria-label="Fechar calendário"
                  onClick={() => setAberto(false)}
                />
                <div className="relative z-[90] mt-2">{painelCalendario}</div>
              </>
            ))}
    </div>
  );
}
