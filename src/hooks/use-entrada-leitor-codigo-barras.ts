"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { extrairNumeroOsCodigo, limparEntradaLeitorCodigo } from "@/lib/codigo-barras-os";

const INTERVALO_TECLA_SCAN_MS = 100;
const PAUSA_FIM_SCAN_MS = 180;

export type EntradaLeitorOpcoes = {
  onLido: (numeroOs: string, bruto: string) => void;
  /** Confirma automaticamente após pausa típica de leitor USB (padrão: true). */
  autoUsb?: boolean;
  /** Captura teclas no documento (útil no modal do leitor). */
  capturaGlobal?: boolean;
  capturaGlobalAtivo?: boolean;
  /** Atualiza o campo visível enquanto o leitor USB digita. */
  onEntrada?: (valor: string) => void;
  /** Elemento que já trata teclas localmente (evita duplicar no documento). */
  ignorarElemento?: RefObject<HTMLElement | null>;
};

function teclaDigitavel(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }) {
  return (
    e.key.length === 1 &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey
  );
}

function teclaConfirma(e: { key: string }) {
  return e.key === "Enter" || e.key === "Tab";
}

export function useEntradaLeitorCodigo({
  onLido,
  autoUsb = true,
  capturaGlobal = false,
  capturaGlobalAtivo = false,
  onEntrada,
  ignorarElemento,
}: EntradaLeitorOpcoes) {
  const ultimoCharMs = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanRapidoRef = useRef(false);
  const bufferRef = useRef("");
  const [leitorUsbAtivo, setLeitorUsbAtivo] = useState(false);
  const [ultimoBruto, setUltimoBruto] = useState("");

  const processar = useCallback(
    (bruto: string) => {
      const limpo = limparEntradaLeitorCodigo(bruto);
      const numero = extrairNumeroOsCodigo(limpo);
      if (!numero) return false;
      setUltimoBruto(limpo);
      onLido(numero, limpo);
      return true;
    },
    [onLido]
  );

  const limparBuffer = useCallback(() => {
    bufferRef.current = "";
    scanRapidoRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const agendarAutoConfirmacao = useCallback(() => {
    if (!autoUsb || !scanRapidoRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const bruto = bufferRef.current;
      limparBuffer();
      if (processar(bruto)) {
        onEntrada?.("");
      }
    }, PAUSA_FIM_SCAN_MS);
  }, [autoUsb, limparBuffer, onEntrada, processar]);

  const processarTecla = useCallback(
    (
      e: KeyboardEvent | React.KeyboardEvent<HTMLInputElement>,
      setValor?: (v: string) => void
    ) => {
      if (teclaConfirma(e)) {
        e.preventDefault();
        let bruto = bufferRef.current;
        if (!bruto && "currentTarget" in e && e.currentTarget instanceof HTMLInputElement) {
          bruto = e.currentTarget.value;
        }
        limparBuffer();
        if (processar(bruto)) {
          setValor?.("");
          onEntrada?.("");
        }
        return;
      }

      if (e.key === "Backspace") {
        bufferRef.current = bufferRef.current.slice(0, -1);
        const visivel = bufferRef.current;
        setValor?.(visivel);
        onEntrada?.(visivel);
        return;
      }

      if (!teclaDigitavel(e)) return;

      const agora = Date.now();
      const intervalo = ultimoCharMs.current ? agora - ultimoCharMs.current : 999;
      ultimoCharMs.current = agora;

      if (intervalo > INTERVALO_TECLA_SCAN_MS * 2) {
        bufferRef.current = e.key;
        scanRapidoRef.current = false;
      } else {
        bufferRef.current += e.key;
        scanRapidoRef.current = true;
        setLeitorUsbAtivo(true);
      }

      const visivel = bufferRef.current;
      setValor?.(visivel);
      onEntrada?.(visivel);
      agendarAutoConfirmacao();
    },
    [agendarAutoConfirmacao, limparBuffer, onEntrada, processar]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, setValor?: (v: string) => void) => {
      processarTecla(e, setValor);
    },
    [processarTecla]
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, setValor?: (v: string) => void) => {
      const valor = e.target.value;
      setValor?.(valor);
      onEntrada?.(valor);

      if (!scanRapidoRef.current) {
        bufferRef.current = valor;
      }
    },
    [onEntrada]
  );

  useEffect(() => {
    if (!capturaGlobal || !capturaGlobalAtivo) return;

    const handler = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (ignorarElemento?.current && alvo === ignorarElemento.current) return;
      const tag = alvo?.tagName?.toLowerCase();
      if (tag === "textarea" || alvo?.isContentEditable) return;

      processarTecla(e);
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [capturaGlobal, capturaGlobalAtivo, ignorarElemento, processarTecla]);

  useEffect(() => {
    if (!capturaGlobalAtivo) {
      limparBuffer();
      setLeitorUsbAtivo(false);
    }
  }, [capturaGlobalAtivo, limparBuffer]);

  return { onKeyDown, onChange, processar, leitorUsbAtivo, ultimoBruto, limparBuffer };
}
