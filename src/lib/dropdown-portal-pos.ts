export type PosicaoMenuDropdown = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

/** Lê o zoom global do site (`html { zoom: var(--site-zoom) }`). */
export function lerZoomDocumento() {
  if (typeof window === "undefined") return 1;
  const root = document.documentElement;
  const fromVar = getComputedStyle(root).getPropertyValue("--site-zoom").trim();
  const fromZoom = getComputedStyle(root).zoom;
  const parsed = parseFloat(fromVar || fromZoom || "1");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Posiciona menu em portal sempre abaixo do anchor (corrige zoom do documento). */
export function calcularPosicaoMenuAbaixo(
  anchor: HTMLElement,
  options?: { gap?: number; alturaMaxima?: number }
): PosicaoMenuDropdown {
  const gap = options?.gap ?? 4;
  const alturaMaxima = options?.alturaMaxima ?? 340;
  const rect = anchor.getBoundingClientRect();
  const zoom = lerZoomDocumento();

  const top = (rect.bottom + gap) / zoom;
  const left = rect.left / zoom;
  const width = rect.width / zoom;
  const espacoAbaixo = (window.innerHeight - rect.bottom - gap) / zoom;
  const maxHeight = Math.min(alturaMaxima, Math.max(120, espacoAbaixo - 8));

  return { top, left, width, maxHeight };
}
