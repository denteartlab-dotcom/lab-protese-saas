"use client";

import type { RefObject } from "react";
import { useEntradaLeitorCodigo } from "@/hooks/use-entrada-leitor-codigo-barras";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onCodigoLido: (numeroOs: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  mostrarStatusLeitor?: boolean;
  autoComplete?: string;
};

export function InputLeitorCodigoOs({
  value,
  onChange,
  onCodigoLido,
  className,
  placeholder,
  autoFocus,
  inputRef,
  mostrarStatusLeitor = false,
  autoComplete = "off",
}: Props) {
  const { onKeyDown, onChange: onChangeLeitor, leitorUsbAtivo } = useEntradaLeitorCodigo({
    onLido: (numero) => {
      onCodigoLido(numero);
    },
  });

  return (
    <div className={cn("relative min-w-0 flex-1", mostrarStatusLeitor && "flex flex-col gap-1")}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChangeLeitor(e, onChange)}
        onKeyDown={(e) => onKeyDown(e, onChange)}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={className}
      />
      {mostrarStatusLeitor && leitorUsbAtivo && (
        <span className="text-[10px] font-medium text-emerald-600">Leitor USB detectado</span>
      )}
    </div>
  );
}
