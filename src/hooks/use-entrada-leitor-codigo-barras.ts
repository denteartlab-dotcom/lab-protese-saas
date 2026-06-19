"use client";

import { useCallback, useRef, useState } from "react";
import { extrairNumeroOsCodigo, limparEntradaLeitorCodigo } from "@/lib/codigo-barras-os";

const INTERVALO_TECLA_SCAN_MS = 80;
const PAUSA_FIM_SCAN_MS = 140;

export type EntradaLeitorOpcoes = {
  onLido: (numeroOs: string, bruto: string) => void;
  /** Confirma automaticamente após pausa típica de leitor USB (padrão: true). */
  autoUsb?: boolean;
};

export function useEntradaLeitorCodigo({ onLido, autoUsb = true }: EntradaLeitorOpcoes) {
  const ultimoCharMs = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanRapidoRef = useRef(false);
  const [leitorUsbAtivo, setLeitorUsbAtivo] = useState(false);

  const processar = useCallback(
    (bruto: string) => {
      const limpo = limparEntradaLeitorCodigo(bruto);
      const numero = extrairNumeroOsCodigo(limpo);
      if (!numero) return false;
      onLido(numero, limpo);
      return true;
    },
    [onLido]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, setValor?: (v: string) => void) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (processar(e.currentTarget.value)) {
          setValor?.("");
        }
      }
    },
    [processar]
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, setValor?: (v: string) => void) => {
      const valor = e.target.value;
      setValor?.(valor);

      if (!autoUsb) return;

      const agora = Date.now();
      const intervalo = ultimoCharMs.current ? agora - ultimoCharMs.current : 0;
      ultimoCharMs.current = agora;

      if (intervalo > 0 && intervalo < INTERVALO_TECLA_SCAN_MS) {
        scanRapidoRef.current = true;
        setLeitorUsbAtivo(true);
      } else if (intervalo > INTERVALO_TECLA_SCAN_MS * 4) {
        scanRapidoRef.current = false;
      }

      if (timerRef.current) clearTimeout(timerRef.current);

      const limpo = limparEntradaLeitorCodigo(valor);
      const pareceCodigo = Boolean(extrairNumeroOsCodigo(limpo));

      if (scanRapidoRef.current && pareceCodigo) {
        timerRef.current = setTimeout(() => {
          scanRapidoRef.current = false;
          if (processar(valor)) {
            setValor?.("");
          }
        }, PAUSA_FIM_SCAN_MS);
      }
    },
    [autoUsb, processar]
  );

  return { onKeyDown, onChange, processar, leitorUsbAtivo };
}
