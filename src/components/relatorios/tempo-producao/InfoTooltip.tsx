"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  texto: string;
  className?: string;
  lado?: "top" | "bottom";
};

const GAP = 6;

export function InfoTooltip({ texto, className, lado = "top" }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  const atualizarPosicao = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      left: rect.left + rect.width / 2,
      top: lado === "top" ? rect.top - GAP : rect.bottom + GAP,
    });
  }, [lado]);

  useLayoutEffect(() => {
    if (!visivel) return;
    atualizarPosicao();
  }, [visivel, atualizarPosicao]);

  useEffect(() => {
    if (!visivel) return;
    const onScroll = () => atualizarPosicao();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [visivel, atualizarPosicao]);

  const tooltip =
    visivel && montado
      ? createPortal(
          <span
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: lado === "top" ? "translate(-50%, -100%)" : "translateX(-50%)",
              zIndex: 99999,
            }}
            className="pointer-events-none w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-normal leading-snug text-slate-600 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {texto}
          </span>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn("inline-flex shrink-0 rounded-full", className)}
        aria-label="Ajuda"
        onMouseEnter={() => setVisivel(true)}
        onMouseLeave={() => setVisivel(false)}
        onFocus={() => setVisivel(true)}
        onBlur={() => setVisivel(false)}
      >
        <HelpCircle className="h-3.5 w-3.5 cursor-help text-slate-400 transition hover:text-primary-500 dark:text-slate-500 dark:hover:text-primary-400" />
      </button>
      {tooltip}
    </>
  );
}
