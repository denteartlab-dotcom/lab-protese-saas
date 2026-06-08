"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const HORAS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTOS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function normalizarHora(value: string) {
  const limpo = value.replace(/[^\d:]/g, "").slice(0, 5);
  const partes = limpo.split(":");
  const hora = (partes[0] || "").slice(0, 2);
  const minuto = (partes[1] || "").slice(0, 2);
  if (!hora && !minuto) return "";
  if (hora.length < 2) return hora;
  if (!limpo.includes(":")) return hora;
  return `${hora.padStart(2, "0")}:${minuto.padEnd(2, "0").slice(0, 2)}`;
}

function horaValida(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "00:00";
  const hora = Math.min(23, Math.max(0, Number(match[1]) || 0));
  const minuto = Math.min(59, Math.max(0, Number(match[2]) || 0));
  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

type PosicaoPainel = { top: number; left: number };

function calcularPosicaoPainel(anchor: HTMLElement): PosicaoPainel {
  const rect = anchor.getBoundingClientRect();
  const largura = 220;
  let left = rect.left;
  if (left + largura > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - largura - 8);
  }
  const top = rect.bottom + 6;
  return { top, left };
}

export function CampoHoraBr({
  value,
  onChange,
  label,
  placeholder = "00:00",
  className,
  inputClassName,
  disabled = false,
  calendarZIndex = 9999,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  calendarZIndex?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<PosicaoPainel | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const horaAtual = horaValida(value || placeholder);

  const atualizarPosicao = useCallback(() => {
    if (!anchorRef.current) return;
    setPosicao(calcularPosicaoPainel(anchorRef.current));
  }, []);

  function aplicarHora(nova: string) {
    onChange(horaValida(nova));
  }

  function abrirPainel() {
    if (disabled) return;
    if (!aberto) {
      atualizarPosicao();
      setAberto(true);
    } else {
      setAberto(false);
    }
  }

  useEffect(() => {
    if (!aberto) return;
    atualizarPosicao();
    window.addEventListener("resize", atualizarPosicao);
    window.addEventListener("scroll", atualizarPosicao, true);
    return () => {
      window.removeEventListener("resize", atualizarPosicao);
      window.removeEventListener("scroll", atualizarPosicao, true);
    };
  }, [aberto, atualizarPosicao]);

  const [horaSel, minutoSel] = horaAtual.split(":");

  const painelHora = (
    <div className="w-[13.75rem] rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
      <p className="mb-2 text-center text-[11px] font-semibold text-slate-600">Selecionar horário</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">Hora</label>
          <select
            value={horaSel}
            onChange={(e) => aplicarHora(`${e.target.value}:${minutoSel}`)}
            className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:border-primary-500"
          >
            {HORAS.map((hora) => (
              <option key={hora} value={hora}>
                {hora}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">Minuto</label>
          <select
            value={minutoSel}
            onChange={(e) => aplicarHora(`${horaSel}:${e.target.value}`)}
            className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:border-primary-500"
          >
            {MINUTOS.map((minuto) => (
              <option key={minuto} value={minuto}>
                {minuto}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          aplicarHora("00:00");
          setAberto(false);
        }}
        className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        Zerar (00:00)
      </button>
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
          onChange={(e) => onChange(normalizarHora(e.target.value))}
          onBlur={() => {
            if (value.trim()) aplicarHora(value);
            else onChange("00:00");
          }}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20",
            disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
            inputClassName
          )}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={abrirPainel}
          className={cn(
            "absolute left-2 top-1/2 z-[1] -translate-y-1/2 text-slate-400 hover:text-primary-600",
            disabled && "pointer-events-none opacity-40"
          )}
          title="Abrir relógio"
          aria-label="Abrir relógio"
          aria-expanded={aberto}
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
      </div>
      {aberto &&
        typeof document !== "undefined" &&
        posicao &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 cursor-default bg-transparent"
              style={{ zIndex: calendarZIndex - 1 }}
              aria-label="Fechar relógio"
              onClick={() => setAberto(false)}
            />
            <div
              className="fixed"
              style={{ top: posicao.top, left: posicao.left, zIndex: calendarZIndex }}
              role="dialog"
              aria-label="Selecionar horário"
            >
              {painelHora}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
