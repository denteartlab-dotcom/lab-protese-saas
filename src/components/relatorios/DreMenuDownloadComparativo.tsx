"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DrePontoGrafico } from "@/lib/dre-graficos";
import {
  exportarComparativoMensalCsv,
  exportarGraficoPng,
  exportarGraficoSvg,
} from "@/lib/exportar-grafico";

type DreMenuDownloadComparativoProps = {
  chartRef: RefObject<HTMLDivElement | null>;
  dados: DrePontoGrafico[];
  ano: number;
};

const itemClass =
  "block w-full border-0 bg-transparent px-3 py-2 text-left text-[12px] text-[#374151] hover:bg-[#f3f4f6]";

export function DreMenuDownloadComparativo({
  chartRef,
  dados,
  ano,
}: DreMenuDownloadComparativoProps) {
  const [aberto, setAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const base = `dre-comparativo-mensal-${ano}`;

  function baixarSvg() {
    exportarGraficoSvg(chartRef.current, `${base}.svg`);
    setAberto(false);
  }

  function baixarPng() {
    exportarGraficoPng(chartRef.current, `${base}.png`);
    setAberto(false);
  }

  function baixarCsv() {
    exportarComparativoMensalCsv(dados, ano);
    setAberto(false);
  }

  return (
    <div
      ref={menuRef}
      className="relative flex shrink-0 items-center gap-2 text-[11px] text-[#9ca3af]"
    >
      <span>Comparativo mensal</span>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={cn(
          "rounded p-1 text-[#6b7280] hover:bg-[#f3f4f6]",
          aberto && "bg-[#f3f4f6]"
        )}
        aria-label="Download do gráfico"
        aria-expanded={aberto}
      >
        <Menu className="h-4 w-4" />
      </button>
      {aberto ? (
        <div
          className="absolute right-0 top-full z-30 mt-1 min-w-[148px] overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-md"
          role="menu"
        >
          <button type="button" className={itemClass} role="menuitem" onClick={baixarSvg}>
            Download SVG
          </button>
          <button type="button" className={itemClass} role="menuitem" onClick={baixarPng}>
            Download PNG
          </button>
          <button type="button" className={itemClass} role="menuitem" onClick={baixarCsv}>
            Download CSV
          </button>
        </div>
      ) : null}
    </div>
  );
}
