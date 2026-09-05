import { formatarDataNoFuso } from "@/lib/timezone";

/** Formata digitação para dd/mm/aaaa */
export function formatDateBr(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const clamp = (raw: string, min: number, max: number) => {
    if (raw.length < 2) return raw;
    const n = Math.min(Math.max(Number(raw) || min, min), max);
    return String(n).padStart(2, "0");
  };
  const day = clamp(digits.slice(0, 2), 1, 31);
  const month = clamp(digits.slice(2, 4), 1, 12);
  let year = digits.slice(4, 8);
  if (year.length === 4) {
    year = String(Math.min(Math.max(Number(year) || 1, 1), 9999)).padStart(4, "0");
  }
  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;
  return `${day}/${month}/${year}`;
}

export function dateToBrShort(date: Date) {
  return formatarDataNoFuso(date);
}

export function parseBrDate(value: string) {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  if (day < 1 || day > 31 || month < 1 || month > 12 || fullYear < 1 || fullYear > 9999) return null;
  const date = new Date(fullYear, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getDate() !== day ||
    date.getMonth() !== month - 1 ||
    date.getFullYear() !== fullYear
  ) {
    return null;
  }
  return date;
}

export function brShortToIso(value: string) {
  const date = parseBrDate(value);
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Soma meses a uma data dd/mm/aaaa (ajusta o dia em meses curtos). */
export function somarMesesDataBr(value: string, meses: number) {
  const date = parseBrDate(value);
  if (!date || !meses) return value;
  const dia = date.getDate();
  const alvo = new Date(date.getFullYear(), date.getMonth() + meses, 1, 12);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(dia, ultimoDia));
  return dateToBrShort(alvo);
}

/** Soma dias a uma data dd/mm/aaaa e devolve no mesmo formato. */
export function somarDiasBr(value: string, dias: number) {
  const date = parseBrDate(value);
  if (!date) return value;
  date.setDate(date.getDate() + dias);
  return dateToBrShort(date);
}

/** Soma dias a uma data ISO yyyy-mm-dd. */
export function somarDiasIso(iso: string, dias: number) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const base = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(iso);
  if (Number.isNaN(base.getTime())) return iso;
  base.setDate(base.getDate() + dias);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Início e fim do mês calendário vigente (00:00 do dia 1 até 23:59:59 do último dia). */
export function intervaloMesVigente(base = new Date()) {
  const referencia = new Date(base);
  const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
  fim.setHours(23, 59, 59, 999);
  return { inicio, fim };
}

/** Verifica se a data cai no mês calendário vigente. */
export function dataNoMesVigente(data: Date, base = new Date()) {
  const { inicio, fim } = intervaloMesVigente(base);
  const valor = new Date(data);
  valor.setHours(12, 0, 0, 0);
  return valor >= inicio && valor <= fim;
}
