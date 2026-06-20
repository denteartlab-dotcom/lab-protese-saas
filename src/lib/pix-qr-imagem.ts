/** Mercado Pago retorna JPEG em base64; alguns fluxos já trazem data URL completa. */
export function srcImagemQrPixPix(encoded: string | null | undefined): string | null {
  if (!encoded?.trim()) return null;
  const raw = encoded.trim().replace(/\s/g, "");
  if (raw.startsWith("data:image/")) return raw;
  return `data:image/jpeg;base64,${raw}`;
}
