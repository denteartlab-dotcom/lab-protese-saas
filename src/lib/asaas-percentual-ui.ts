/** Formata percentual BR com 2 casas (ex.: digitar 5 → 0,05). */
export function formatarPercentualInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (!digits) return "";
  const n = Number(digits) / 100;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parsePercentualBr(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function percentualParaInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return formatarPercentualInput("0");
  }
  const centesimos = Math.round(value * 100);
  return formatarPercentualInput(String(centesimos));
}

export function formatarPercentualExibicao(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}
