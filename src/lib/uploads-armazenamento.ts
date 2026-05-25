/** Constantes e formatação — seguro para importar no cliente. */

export const LIMITE_GALERIA_GB = 80;
export const LIMITE_ARMAZENAMENTO_BYTES = LIMITE_GALERIA_GB * 1024 ** 3;
export const UPLOADS_ATUALIZADO_EVENT = "labProteseUploadsAtualizado";

export function notificarUploadsAtualizados() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UPLOADS_ATUALIZADO_EVENT));
}

const fmtPt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const fmtPtGbPreciso = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

/** Sempre em GB (card Uploads do Início). */
export function formatarTamanhoGb(bytes: number): string {
  const n = Math.max(0, bytes);
  const gb = n / 1024 ** 3;
  if (gb === 0) return "0 GB";
  if (gb < 1) return `${fmtPtGbPreciso.format(gb)} GB`;
  if (gb >= 10) return `${fmtPt.format(Math.round(gb))} GB`;
  return `${fmtPt.format(Math.round(gb * 10) / 10)} GB`;
}

/** Exibe KB/MB/GB conforme o tamanho (lista de arquivos). */
export function formatarTamanhoArmazenamento(bytes: number): string {
  const n = Math.max(0, bytes);
  if (n === 0) return "0 MB";
  const mb = n / (1024 * 1024);
  if (mb < 1024) {
    if (mb < 1) return `${fmtPt.format(Math.max(n / 1024, 0.1))} KB`;
    return `${fmtPt.format(Math.round(mb * 10) / 10)} MB`;
  }
  const gb = mb / 1024;
  if (gb >= 10) return `${fmtPt.format(Math.round(gb))} GB`;
  return `${fmtPt.format(Math.round(gb * 10) / 10)} GB`;
}

export function formatarGb(bytes: number, casas = 1) {
  const gb = bytes / 1024 ** 3;
  if (gb >= 10) return `${Math.round(gb)} GB`;
  return `${gb.toFixed(casas)} GB`;
}
