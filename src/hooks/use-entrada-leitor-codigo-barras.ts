"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { extrairNumeroOsCodigo, limparEntradaLeitorCodigo } from "@/lib/codigo-barras-os";

const INTERVALO_TECLA_SCAN_MS = 100;
const PAUSA_FIM_SCAN_MS = 200;

export type EntradaLeitorOpcoes = {
  onLido: (numeroOs: string, bruto: string) => void;
  /** Confirma automaticamente após pausa típica de leitor USB (padrão: true). */
  autoUsb?: boolean;
  /** Captura teclas no documento (leitor USB funciona sem clicar no campo). */
  capturaGlobal?: boolean;
  capturaGlobalAtivo?: boolean;
  /** Atualiza o campo visível enquanto o leitor USB digita. */
  onEntrada?: (valor: string) => void;
  /** Código lido mas não reconhecido como OS. */
  onInvalido?: (bruto: string) => void;
  ignorarElemento?: RefObject<HTMLElement | null>;
};

function teclaDigitavel(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }) {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
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
  onInvalido,
  ignorarElemento,
}: EntradaLeitorOpcoes) {
  const ultimoCharMs = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanRapidoRef = useRef(false);
  const bufferRef = useRef("");
  const ultimoEventoRef = useRef("");
  const [leitorUsbAtivo, setLeitorUsbAtivo] = useState(false);
  const [ultimoBruto, setUltimoBruto] = useState("");

  const atualizarVisivel = useCallback(
    (valor: string, setValor?: (v: string) => void) => {
      setValor?.(valor);
      onEntrada?.(valor);
      setUltimoBruto(valor);
    },
    [onEntrada]
  );

  const processar = useCallback(
    (bruto: string) => {
      const limpo = limparEntradaLeitorCodigo(bruto);
      if (!limpo) return false;
      const numero = extrairNumeroOsCodigo(limpo);
      if (!numero) {
        onInvalido?.(limpo);
        return false;
      }
      setUltimoBruto(limpo);
      onLido(numero, limpo);
      return true;
    },
    [onInvalido, onLido]
  );

  const limparBuffer = useCallback(() => {
    bufferRef.current = "";
    scanRapidoRef.current = false;
    ultimoEventoRef.current = "";
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const confirmarBuffer = useCallback(
    (setValor?: (v: string) => void) => {
      const bruto = bufferRef.current;
      limparBuffer();
      if (!bruto.trim()) return false;
      const ok = processar(bruto);
      if (ok) {
        atualizarVisivel("", setValor);
      }
      return ok;
    },
    [atualizarVisivel, limparBuffer, processar]
  );

  const agendarAutoConfirmacao = useCallback(
    (setValor?: (v: string) => void) => {
      if (!autoUsb || !scanRapidoRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        confirmarBuffer(setValor);
      }, PAUSA_FIM_SCAN_MS);
    },
    [autoUsb, confirmarBuffer]
  );

  const processarTecla = useCallback(
    (
      e: KeyboardEvent | React.KeyboardEvent<HTMLInputElement>,
      setValor?: (v: string) => void
    ) => {
      const chaveEvento = `${e.timeStamp}:${e.key}`;
      if (ultimoEventoRef.current === chaveEvento) return;
      ultimoEventoRef.current = chaveEvento;

      if (teclaConfirma(e)) {
        e.preventDefault();
        e.stopPropagation();
        let bruto = bufferRef.current;
        if (!bruto && "currentTarget" in e && e.currentTarget instanceof HTMLInputElement) {
          bruto = e.currentTarget.value;
        }
        limparBuffer();
        if (bruto.trim()) {
          processar(bruto);
          atualizarVisivel("", setValor);
        }
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        bufferRef.current = bufferRef.current.slice(0, -1);
        atualizarVisivel(bufferRef.current, setValor);
        return;
      }

      if (!teclaDigitavel(e)) return;

      e.preventDefault();
      e.stopPropagation();

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

      atualizarVisivel(bufferRef.current, setValor);
      agendarAutoConfirmacao(setValor);
    },
    [agendarAutoConfirmacao, atualizarVisivel, limparBuffer, processar]
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
      if (scanRapidoRef.current) return;
      bufferRef.current = valor;
      atualizarVisivel(valor, setValor);
    },
    [atualizarVisivel]
  );

  const onInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>, setValor?: (v: string) => void) => {
      const valor = e.currentTarget.value;
      if (!valor.trim()) return;
      if (scanRapidoRef.current || valor.length >= 2) {
        bufferRef.current = valor;
        atualizarVisivel(valor, setValor);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          confirmarBuffer(setValor);
        }, PAUSA_FIM_SCAN_MS);
      }
    },
    [atualizarVisivel, confirmarBuffer]
  );

  useEffect(() => {
    if (!capturaGlobal || !capturaGlobalAtivo) return;

    const handler = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (ignorarElemento?.current && alvo === ignorarElemento.current) return;
      const tag = alvo?.tagName?.toLowerCase();
      if (tag === "textarea" || alvo?.isContentEditable) return;
      if (tag === "input" && alvo !== ignorarElemento?.current) {
        const tipo = (alvo as HTMLInputElement).type?.toLowerCase();
        if (tipo && tipo !== "text" && tipo !== "search" && tipo !== "tel") return;
      }

      processarTecla(e);
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [capturaGlobal, capturaGlobalAtivo, ignorarElemento, processarTecla]);

  useEffect(() => {
    if (!capturaGlobalAtivo) {
      limparBuffer();
      setLeitorUsbAtivo(false);
      setUltimoBruto("");
    }
  }, [capturaGlobalAtivo, limparBuffer]);

  return {
    onKeyDown,
    onChange,
    onInput,
    processar,
    leitorUsbAtivo,
    ultimoBruto,
    limparBuffer,
  };
}
