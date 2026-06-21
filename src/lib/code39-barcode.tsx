"use client";

import { gerarBarrasCode39 } from "@/lib/code39-barcode-core";

export {
  gerarBarrasCode39,
  gerarPngCode39DataUrl,
  normalizarValorCode39,
  svgCode39Html,
} from "@/lib/code39-barcode-core";

function rotuloCode39(value: string) {
  return value.toUpperCase().replace(/^\*+|\*+$/g, "").trim();
}

export function Code39Barcode({
  value,
  height = 34,
  className,
  showLabel = true,
}: {
  value: string;
  height?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const { barras, width } = gerarBarrasCode39(value);
  if (!width) return null;

  const rotulo = rotuloCode39(value);

  return (
    <div
      className={className}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Código de barras ${rotulo}`}
      >
        {barras.map((barra, index) => (
          <rect key={index} x={barra.x} y={0} width={barra.w} height={height} fill="#000000" />
        ))}
      </svg>
      {showLabel && rotulo ? (
        <span
          className="font-mono leading-none text-black"
          style={{
            fontSize: Math.max(9, Math.round(height * 0.28)),
            marginTop: 2,
            letterSpacing: "0.06em",
          }}
        >
          {rotulo}
        </span>
      ) : null}
    </div>
  );
}
