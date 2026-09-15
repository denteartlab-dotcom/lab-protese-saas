"use client";

import { useEffect, useState } from "react";

type Props = {
  src?: string;
  alt?: string;
  fallbackLetter?: string;
  size?: number;
  className?: string;
};

/**
 * Remove fundo branco/quase branco de um data URL ou URL de imagem (canvas no browser).
 * Útil para logos enviados com fundo opaco no login.
 */
export async function removerFundoBrancoLogo(src: string): Promise<string> {
  const img = await carregarImagem(src);
  const maxLado = 256;
  const ratio = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;
  const visitado = new Uint8Array(total);
  const fila: number[] = [];

  const ehQuaseBranco = (i: number) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 18) return true;
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    // Branco / off-white sem muita saturação
    return min >= 232 && max - min <= 28;
  };

  const enfileirar = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visitado[idx]) return;
    visitado[idx] = 1;
    const i = idx * 4;
    if (ehQuaseBranco(i)) fila.push(idx);
  };

  // Flood a partir das bordas — remove o “quadrado” branco do fundo
  for (let x = 0; x < w; x += 1) {
    enfileirar(x, 0);
    enfileirar(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    enfileirar(0, y);
    enfileirar(w - 1, y);
  }

  while (fila.length) {
    const idx = fila.pop()!;
    const i = idx * 4;
    data[i + 3] = 0;
    const x = idx % w;
    const y = (idx / w) | 0;
    enfileirar(x + 1, y);
    enfileirar(x - 1, y);
    enfileirar(x, y + 1);
    enfileirar(x, y - 1);
  }

  // Suaviza pixels restantes quase brancos (halos)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    if (min >= 210 && max - min <= 36) {
      const t = (min - 210) / 45;
      data[i + 3] = Math.max(0, Math.round(data[i + 3] * (1 - t)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    // data URLs e same-origin não precisam de CORS; paths públicos ok
    if (!src.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar logo"));
    img.src = src;
  });
}

/**
 * Logo do login em moldura redonda, com fundo branco removido automaticamente.
 */
export function LoginLogoCircular({
  src,
  alt = "Logo",
  fallbackLetter = "L",
  size = 44,
  className = "",
}: Props) {
  const [processado, setProcessado] = useState<string>("");
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const origem = src?.trim() || "";
    if (!origem) {
      setProcessado("");
      setFalhou(false);
      return;
    }
    setFalhou(false);
    void removerFundoBrancoLogo(origem)
      .then((url) => {
        if (!cancelado) setProcessado(url);
      })
      .catch(() => {
        if (!cancelado) {
          setProcessado(origem);
          setFalhou(true);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [src]);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-sky-50 to-blue-100 ring-2 ring-blue-200/80 shadow-sm ${className}`}
      style={{ width: size, height: size }}
      aria-hidden={!processado}
    >
      {processado && !falhou ? (
        <img
          src={processado}
          alt={alt}
          className="h-full w-full object-contain p-[18%]"
          draggable={false}
        />
      ) : processado ? (
        <img
          src={processado}
          alt={alt}
          className="h-full w-full object-contain p-[14%]"
          draggable={false}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-blue-700">
          {(fallbackLetter || "L").charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
