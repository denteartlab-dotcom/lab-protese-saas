/** Intervalo mínimo entre mensagens de campanha (anti-spam / banimento). */
export const DISPARO_INTERVALO_MIN_SEG = 30;

/** Intervalo máximo entre mensagens (5 minutos). */
export const DISPARO_INTERVALO_MAX_SEG = 300;

/** Padrão recomendado ao criar campanha. */
export const DISPARO_INTERVALO_PADRAO_SEG = 60;

export const DISPARO_INTERVALO_STEP_SEG = 30;

/** Marcas exibidas no controle deslizante do wizard. */
export const MARCAS_INTERVALO_DISPARO_SEG = [30, 60, 120, 180, 240, 300] as const;

export function formatarIntervaloDisparo(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return "—";
  if (segundos < 60) return `${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  if (resto === 0) return minutos === 1 ? "1 min" : `${minutos} min`;
  return `${minutos} min ${resto}s`;
}
