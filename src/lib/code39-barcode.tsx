"use client";

import { gerarBarrasCode39 } from "@/lib/code39-barcode-core";

export {
  gerarBarrasCode39,
  gerarPngCode39DataUrl,
  normalizarValorCode39,
  svgCode39Html,
} from "@/lib/code39-barcode-core";

export function Code39Barcode({
  value,
  height = 34,
  className,
}: {
  value: string;
  height?: number;
  className?: string;
}) {
  const { barras, width } = gerarBarrasCode39(value);
  if (!width) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Código de barras ${value}`}
    >
      {barras.map((barra, index) => (
        <rect key={index} x={barra.x} y={0} width={barra.w} height={height} fill="#000000" />
      ))}
    </svg>
  );
}
