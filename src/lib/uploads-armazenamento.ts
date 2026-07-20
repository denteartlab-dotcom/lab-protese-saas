/** Constantes e formatação — seguro para importar no cliente. */

export const LIMITE_GALERIA_GB = 20;
/** Alerta visual/notificação no Início quando o uso atinge este limiar. */
export const ALERTA_ARMAZENAMENTO_GB = 18;
export const LIMITE_ARMAZENAMENTO_BYTES = LIMITE_GALERIA_GB * 1024 ** 3;
export const ALERTA_ARMAZENAMENTO_BYTES = ALERTA_ARMAZENAMENTO_GB * 1024 ** 3;
export const UPLOADS_ATUALIZADO_EVENT = "labProteseUploadsAtualizado";

export type UploadsResumoArmazenamento = {
  bytesUsados: number;
  bytesLivres: number;
  limiteBytes?: number;
  limiteGb: number;
  percentualUsado: number;
  percentualLivre: number;
};

export const MENSAGEM_LIMITE_GALERIA_ESGOTADO =
  "Espaço de uploads esgotado (0 GB livre). Libere espaço em Início → Uploads → Liberar espaço ou acesse /app/liberar-espaco.";

export function armazenamentoGaleriaEsgotado(bytesLivres: number): boolean {
  return bytesLivres <= 0;
}

/** Quase cheio: ≥ 18 GB usados (de 20 GB). Volta ao normal ao liberar espaço. */
export function armazenamentoGaleriaEmAlerta(bytesUsados: number): boolean {
  return bytesUsados >= ALERTA_ARMAZENAMENTO_BYTES;
}

export function somaBytesArquivos(arquivos: Iterable<File>): number {
  let total = 0;
  for (const arquivo of arquivos) total += arquivo.size;
  return total;
}

export function armazenamentoGaleriaCabeArquivos(
  bytesLivres: number,
  novosBytes: number
): boolean {
  if (armazenamentoGaleriaEsgotado(bytesLivres)) return false;
  return novosBytes <= bytesLivres;
}

export function notificarUploadsAtualizados() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UPLOADS_ATUALIZADO_EVENT));
}

const fmtPt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const fmtPtGbPreciso = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

/** Exibição em MB no card Uploads do Início (limite continua 20 GB). */
export function formatarTamanhoMbCard(bytes: number): string {
  const n = Math.max(0, bytes);
  if (n === 0) return "0 MB";
  const mb = n / (1024 * 1024);
  if (mb < 1) {
    const kb = n / 1024;
    if (kb < 0.1) return "0 MB";
    const kbFmt = Math.round(kb * 10) / 10;
    return `${String(kbFmt).replace(".", ",")} KB`;
  }
  const mbFmt = Math.round(mb * 10) / 10;
  return `${String(mbFmt).replace(".", ",")} MB`;
}

/** @deprecated Preferir formatarTamanhoMbCard no card do Início. */
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
