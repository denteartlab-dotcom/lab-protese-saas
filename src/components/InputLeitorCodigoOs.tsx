"use client";

import type { RefObject } from "react";
import { useEntradaLeitorCodigo } from "@/hooks/use-entrada-leitor-codigo-barras";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onCodigoLido: (numeroOs: string, bruto?: string) => void;
  onCodigoInvalido?: (bruto: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  mostrarStatusLeitor?: boolean;
  capturaGlobal?: boolean;
  capturaGlobalAtivo?: boolean;
  autoComplete?: string;
};

export function InputLeitorCodigoOs({
  value,
  onChange,
  onCodigoLido,
  onCodigoInvalido,
  className,
  placeholder,
  autoFocus,
  inputRef,
  mostrarStatusLeitor = false,
  capturaGlobal = false,
  capturaGlobalAtivo = false,
  autoComplete = "off",
}: Props) {
  const { onKeyDown, onChange: onChangeLeitor, onInput, leitorUsbAtivo, ultimoBruto } =
    useEntradaLeitorCodigo({
      onLido: (numero, bruto) => onCodigoLido(numero, bruto),
      onInvalido: onCodigoInvalido,
      capturaGlobal,
      capturaGlobalAtivo,
      onEntrada: onChange,
    });

  return (
    <div className={cn("relative min-w-0 flex-1", mostrarStatusLeitor && "flex flex-col gap-1")}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChangeLeitor(e, onChange)}
        onInput={(e) => onInput(e, onChange)}
        onKeyDown={(e) => onKeyDown(e, onChange)}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={className}
      />
      {mostrarStatusLeitor && leitorUsbAtivo && (
        <span className="text-[10px] font-medium text-emerald-600">Leitor USB detectado</span>
      )}
      {mostrarStatusLeitor && !leitorUsbAtivo && ultimoBruto && (
        <span className="text-[10px] text-slate-500">Digitado: {ultimoBruto}</span>
      )}
    </div>
  );
}
