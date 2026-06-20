"use client";

import { useEffect, useRef, useState } from "react";
import {
  PIX_ASSINATURA_QR_EXPIRACAO_MS,
  PIX_ASSINATURA_QR_EXPIRACAO_MINUTOS,
} from "@/lib/assinatura-pix-constants";
import { cn } from "@/lib/utils";

function msRestantesPix(expiraEmIso: string | null | undefined): number {
  if (!expiraEmIso) return 0;
  const resto = Math.max(0, new Date(expiraEmIso).getTime() - Date.now());
  return Math.min(resto, PIX_ASSINATURA_QR_EXPIRACAO_MS);
}

export function formatarContagemRegressivaPix(msRestante: number): string {
  if (msRestante <= 0) return "00:00";
  const totalSeg = Math.floor(msRestante / 1000);
  const minutos = Math.floor(totalSeg / 60);
  const segundos = totalSeg % 60;
  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

export function useContagemRegressivaPix(expiraEmIso: string | null | undefined) {
  const [restoMs, setRestoMs] = useState(() => msRestantesPix(expiraEmIso));
  const [expiradoReal, setExpiradoReal] = useState(() => {
    if (!expiraEmIso) return false;
    return new Date(expiraEmIso).getTime() <= Date.now();
  });

  useEffect(() => {
    if (!expiraEmIso) {
      setRestoMs(0);
      setExpiradoReal(false);
      return;
    }
    const tick = () => {
      const agora = Date.now();
      const expira = new Date(expiraEmIso).getTime();
      setExpiradoReal(expira <= agora);
      setRestoMs(Math.min(Math.max(0, expira - agora), PIX_ASSINATURA_QR_EXPIRACAO_MS));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiraEmIso]);

  const expirado = Boolean(expiraEmIso) && expiradoReal;

  return {
    expirado,
    restoMs,
    texto: formatarContagemRegressivaPix(restoMs),
  };
}

type Props = {
  expiraEm: string | null | undefined;
  onGerarNovo?: () => void;
  gerandoNovo?: boolean;
  className?: string;
  compacto?: boolean;
};

export function ContagemRegressivaPixQr({
  expiraEm,
  onGerarNovo,
  gerandoNovo,
  className,
  compacto,
}: Props) {
  const { expirado, texto, restoMs } = useContagemRegressivaPix(expiraEm);
  const expiracaoTratadaRef = useRef<string | null>(null);

  useEffect(() => {
    expiracaoTratadaRef.current = null;
  }, [expiraEm]);

  useEffect(() => {
    if (!expirado || !onGerarNovo || gerandoNovo) return;
    const chave = expiraEm ?? "";
    if (expiracaoTratadaRef.current === chave) return;
    expiracaoTratadaRef.current = chave;
    onGerarNovo();
  }, [expirado, expiraEm, onGerarNovo, gerandoNovo]);

  if (!expiraEm) return null;

  if (expirado) {
    return (
      <div
        className={cn(
          "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-center",
          className
        )}
      >
        <p className={cn("font-semibold text-amber-900", compacto ? "text-xs" : "text-sm")}>
          {gerandoNovo ? "Gerando novo QR Code..." : "QR Code PIX expirado"}
        </p>
        <p className={cn("mt-0.5 text-amber-800", compacto ? "text-[10px]" : "text-xs")}>
          {gerandoNovo
            ? "Aguarde, um novo código será exibido em instantes."
            : "Um novo código será gerado automaticamente."}
        </p>
        {onGerarNovo && !gerandoNovo ? (
          <button
            type="button"
            onClick={onGerarNovo}
            className={cn(
              "mt-2 inline-flex items-center justify-center rounded-lg bg-amber-700 font-medium text-white hover:bg-amber-800",
              compacto ? "h-8 px-3 text-[10px]" : "h-9 px-4 text-xs"
            )}
          >
            Gerar agora
          </button>
        ) : null}
      </div>
    );
  }

  const urgente = restoMs > 0 && restoMs < 5 * 60 * 1000;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-center",
        urgente ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50",
        className
      )}
    >
      <p
        className={cn(
          "uppercase tracking-wide text-slate-500",
          compacto ? "text-[9px]" : "text-[10px]"
        )}
      >
        QR Code expira em
      </p>
      <p
        className={cn(
          "font-mono font-bold tabular-nums",
          urgente ? "text-amber-800" : "text-slate-900",
          compacto ? "text-lg" : "text-2xl"
        )}
      >
        {texto}
      </p>
      <p className={cn("mt-0.5 text-slate-500", compacto ? "text-[9px]" : "text-[10px]")}>
        Válido por {PIX_ASSINATURA_QR_EXPIRACAO_MINUTOS} min — renova sozinho ao expirar
      </p>
    </div>
  );
}
