/** Pix cobrança via Asaas (QR) — exige subconta aprovada. */
export function formaEhPixAsaas(forma?: string | null): boolean {
  return (forma || "").trim().toLowerCase() === "pix";
}

/** Pix recebido fora do sistema (lançamento manual). */
export function formaEhPixExterno(forma?: string | null): boolean {
  const f = (forma || "").trim().toLowerCase();
  return f.includes("pix externo");
}

export function formaEhPixQualquer(forma?: string | null): boolean {
  return formaEhPixAsaas(forma) || formaEhPixExterno(forma);
}
