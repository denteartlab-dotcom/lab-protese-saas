"use client";

import { useEffect, useState } from "react";
import { srcImagemQrPixPix } from "@/lib/pix-qr-imagem";

type Props = {
  pixEncodedImage: string | null | undefined;
  pixPayload: string | null | undefined;
  className?: string;
  alt?: string;
};

export function PixQrCodeVisual({
  pixEncodedImage,
  pixPayload,
  className = "h-48 w-48 rounded border border-slate-200",
  alt = "QR Code PIX",
}: Props) {
  const [geradoPayload, setGeradoPayload] = useState<string | null>(null);

  const srcServidor = srcImagemQrPixPix(pixEncodedImage);

  useEffect(() => {
    if (srcServidor || !pixPayload?.trim()) {
      setGeradoPayload(null);
      return;
    }
    let ativo = true;
    void import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(pixPayload.trim(), {
          width: 256,
          margin: 1,
          errorCorrectionLevel: "M",
        })
      )
      .then((url) => {
        if (ativo) setGeradoPayload(url);
      })
      .catch(() => {
        if (ativo) setGeradoPayload(null);
      });
    return () => {
      ativo = false;
    };
  }, [srcServidor, pixPayload]);

  const src = srcServidor || geradoPayload;
  if (!src) return null;

  return <img src={src} alt={alt} className={className} />;
}
