"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { extrairNumeroOsCodigo, limparEntradaLeitorCodigo } from "@/lib/codigo-barras-os";

const PAUSA_RESET_BUFFER_MS = 600;
const PAUSA_FIM_SCAN_MS = 350;

export type EntradaLeitorOpcoes = {
  onLido?: (numeroOs: string, bruto: string) => void;
  /** Qualquer código (boleto, Pix, etc.) sem validar como OS. */
  onTextoLido?: (bruto: string) => void;
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

function charDaTecla(e: KeyboardEvent | React.KeyboardEvent<HTMLInputElement>): string {
  if (teclaDigitavel(e)) return e.key;
  const legado = "keyCode" in e ? e.keyCode || e.which : 0;
  if (legado >= 32 && legado <= 126) return String.fromCharCode(legado);
  return "";
}

function teclaConfirma(e: { key: string; code?: string }) {
  return (
    e.key === "Enter" ||
    e.key === "Tab" ||
    e.key === "F13" ||
    e.code === "NumpadEnter"
  );
}

function valorInputAtivo(): string {
  const ativo = document.activeElement;
  if (ativo instanceof HTMLInputElement || ativo instanceof HTMLTextAreaElement) {
    return ativo.value;
  }
  return "";
}

export function useEntradaLeitorCodigo({
  onLido,
  onTextoLido,
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
      if (onTextoLido) {
        setUltimoBruto(limpo);
        onTextoLido(limpo);
        return true;
      }
      if (!onLido) return false;
      const numero = extrairNumeroOsCodigo(limpo);
      if (!numero) {
        onInvalido?.(limpo);
        return false;
      }
      setUltimoBruto(limpo);
      onLido(numero, limpo);
      return true;
    },
    [onInvalido, onLido, onTextoLido]
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
        if (!bruto.trim()) bruto = valorInputAtivo();
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

      const alvo = e.target as HTMLElement | null;
      const noCampoLeitor =
        Boolean(ignorarElemento?.current) && alvo === ignorarElemento?.current;

      if (noCampoLeitor) return;

      const char = charDaTecla(e);
      if (!char) return;

      e.preventDefault();
      e.stopPropagation();

      const agora = Date.now();
      const intervalo = ultimoCharMs.current ? agora - ultimoCharMs.current : 999;
      ultimoCharMs.current = agora;

      if (intervalo > PAUSA_RESET_BUFFER_MS) {
        bufferRef.current = char;
        scanRapidoRef.current = false;
      } else {
        bufferRef.current += char;
        scanRapidoRef.current = true;
        setLeitorUsbAtivo(true);
      }

      atualizarVisivel(bufferRef.current, setValor);
      agendarAutoConfirmacao(setValor);
    },
    [agendarAutoConfirmacao, atualizarVisivel, ignorarElemento, limparBuffer, processar]
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
      bufferRef.current = valor;
      if (valor.length >= 2) {
        scanRapidoRef.current = true;
        setLeitorUsbAtivo(true);
      }
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

  const processarTextoLido = useCallback(
    (bruto: string, setValor?: (v: string) => void) => {
      const limpo = limparEntradaLeitorCodigo(bruto);
      if (!limpo) return;
      bufferRef.current = limpo;
      scanRapidoRef.current = limpo.length >= 2;
      if (scanRapidoRef.current) setLeitorUsbAtivo(true);
      atualizarVisivel(limpo, setValor);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        confirmarBuffer(setValor);
      }, PAUSA_FIM_SCAN_MS);
    },
    [atualizarVisivel, confirmarBuffer]
  );

  useEffect(() => {
    if (!capturaGlobal || !capturaGlobalAtivo) return;

    const handlerTecla = (e: KeyboardEvent) => {
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

    const handlerInput = (e: Event) => {
      const alvo = e.target as HTMLElement | null;
      if (!(alvo instanceof HTMLInputElement)) return;
      if (ignorarElemento?.current && alvo === ignorarElemento.current) return;
      const tipo = alvo.type?.toLowerCase();
      if (tipo && tipo !== "text" && tipo !== "search" && tipo !== "tel") return;
      processarTextoLido(alvo.value);
    };

    const handlerColar = (e: ClipboardEvent) => {
      const texto = e.clipboardData?.getData("text")?.trim();
      if (!texto) return;
      e.preventDefault();
      processarTextoLido(texto);
    };

    document.addEventListener("keydown", handlerTecla, true);
    document.addEventListener("input", handlerInput, true);
    document.addEventListener("paste", handlerColar, true);
    return () => {
      document.removeEventListener("keydown", handlerTecla, true);
      document.removeEventListener("input", handlerInput, true);
      document.removeEventListener("paste", handlerColar, true);
    };
  }, [capturaGlobal, capturaGlobalAtivo, ignorarElemento, processarTecla, processarTextoLido]);

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
