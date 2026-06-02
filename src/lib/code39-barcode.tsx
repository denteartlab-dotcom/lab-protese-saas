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

export function gerarBarrasCode39(value: string) {
  const content = normalizarValorCode39(value);
  const narrow = 1.15;
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
