export const MS_PER_DAY = 86_400_000;

export function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function dayKey(date: Date) {
  const d = utcDay(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addUtcDays(date: Date, days: number) {
  const d = utcDay(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

export function addUtcMonths(date: Date, months: number) {
  const d = utcDay(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
}

export function firstUtcDayOfMonth(date: Date) {
  const d = utcDay(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function differenceInUtcDays(later: Date, earlier: Date) {
  return Math.floor((utcDay(later).getTime() - utcDay(earlier).getTime()) / MS_PER_DAY);
}

export function differenceInUtcMonths(later: Date, earlier: Date) {
  const l = utcDay(later); const e = utcDay(earlier);
  return (l.getUTCFullYear() - e.getUTCFullYear()) * 12 + (l.getUTCMonth() - e.getUTCMonth());
}

export function compareUtcDays(a: Date, b: Date) {
  return utcDay(a).getTime() - utcDay(b).getTime();
}

export function onOrAfterUtc(date: Date, boundary: Date) { return compareUtcDays(date, boundary) >= 0; }
export function onOrBeforeUtc(date: Date, boundary: Date) { return compareUtcDays(date, boundary) <= 0; }
export function afterUtc(date: Date, boundary: Date) { return compareUtcDays(date, boundary) > 0; }
export function beforeUtc(date: Date, boundary: Date) { return compareUtcDays(date, boundary) < 0; }

export function formatUtcDateShort(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}
