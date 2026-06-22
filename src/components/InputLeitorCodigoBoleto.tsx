"use client";

import type { RefObject } from "react";
import { useEntradaLeitorCodigo } from "@/hooks/use-entrada-leitor-codigo-barras";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onCodigoLido: (bruto: string) => void;
  onCodigoInvalido?: (bruto: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  mostrarStatusLeitor?: boolean;
  capturaGlobal?: boolean;
  capturaGlobalAtivo?: boolean;
  validar?: (bruto: string) => boolean;
};

export function InputLeitorCodigoBoleto({
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
  validar,
}: Props) {
  const { onKeyDown, onChange: onChangeLeitor, onInput, leitorUsbAtivo, ultimoBruto } =
    useEntradaLeitorCodigo({
      onTextoLido: (bruto) => {
        if (validar && !validar(bruto)) {
          onCodigoInvalido?.(bruto);
          return;
        }
        onCodigoLido(bruto);
      },
      onInvalido: onCodigoInvalido,
      capturaGlobal,
      capturaGlobalAtivo,
      onEntrada: onChange,
    });

  return (
    <div className={cn("relative min-w-0 flex-1", mostrarStatusLeitor && "flex flex-col gap-1")}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChangeLeitor(e, onChange)}
        onInput={(e) => onInput(e, onChange)}
        onKeyDown={(e) => onKeyDown(e, onChange)}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className={className}
      />
      {mostrarStatusLeitor && leitorUsbAtivo && (
        <span className="text-[10px] font-medium text-emerald-600">
          Leitor USB detectado — aguardando código...
        </span>
      )}
      {mostrarStatusLeitor && !leitorUsbAtivo && ultimoBruto && (
        <span className="text-[10px] text-slate-500">Digitado: {ultimoBruto}</span>
      )}
    </div>
  );
}
