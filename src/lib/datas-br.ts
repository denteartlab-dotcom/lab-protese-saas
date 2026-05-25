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
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
