const code39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  "*": "nwnnwnwnn",
};

export function normalizarValorCode39(value: string) {
  return `*${value.toUpperCase().replace(/[^0-9A-Z-. ]/g, "")}*`;
}

export function gerarBarrasCode39(value: string, narrow = 1.15) {
  const content = normalizarValorCode39(value);
  const wide = narrow * 3;
  const barras: Array<{ x: number; w: number }> = [];
  let cursor = 0;

  for (const char of content) {
    const pattern = code39[char] || code39["-"];
    pattern.split("").forEach((part, index) => {
      const w = part === "w" ? wide : narrow;
      if (index % 2 === 0) {
        barras.push({ x: cursor, w });
      }
      cursor += w;
    });
    cursor += narrow;
  }

  return { barras, width: cursor };
}

/** PNG nítido para PDF/impressão — barras em pixels inteiros, sem anti-alias. */
export function gerarPngCode39DataUrl(
  value: string,
  opts?: { narrowPx?: number; heightPx?: number }
): { dataUrl: string; widthPx: number; heightPx: number } | null {
  if (typeof document === "undefined") return null;

  const narrowPx = opts?.narrowPx ?? 4;
  const heightPx = opts?.heightPx ?? 120;
  const { barras, width } = gerarBarrasCode39(value, narrowPx);
  if (!width) return null;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  for (const barra of barras) {
    const x = Math.round(barra.x);
    const w = Math.max(1, Math.round(barra.w));
    ctx.fillRect(x, 0, w, heightPx);
  }

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthPx: canvas.width,
    heightPx,
  };
}

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
