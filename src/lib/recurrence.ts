import type { Entry, Occurrence } from './types';
import { addUtcDays, addUtcMonths, afterUtc, beforeUtc, compareUtcDays, dayKey, differenceInUtcDays, differenceInUtcMonths, firstUtcDayOfMonth, onOrAfterUtc, onOrBeforeUtc, parseDateKey, utcDay } from './dates';

export function resolveMonthDay(monthDate: Date, day?: number | 'LAST') {
  const normalized = utcDay(monthDate);
  const year = normalized.getUTCFullYear();
  const month = normalized.getUTCMonth();
  const end = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const d = day === 'LAST' || day == null ? end : Math.min(day, end);
  return new Date(Date.UTC(year, month, d));
}
function pushIfInRange(out: Occurrence[], entry: Entry, date: Date, from: Date, to: Date) {
  const d = utcDay(date); const skips = new Set(entry.skippedDates ?? []);
  const start = utcDay(entry.startDate); const end = entry.endDate ? utcDay(entry.endDate) : null;
  if (onOrAfterUtc(d, from) && onOrBeforeUtc(d, to) && onOrAfterUtc(d, start) && (!end || onOrBeforeUtc(d, end)) && !skips.has(dayKey(d))) {
    out.push({ id: `${entry.id}:${dayKey(d)}`, entryId: entry.id, name: entry.name, type: entry.type, amountCents: entry.amountCents, date: d, category: entry.category, accountId: entry.accountId, isAuto: entry.isAuto, isVariable: entry.isVariable });
  }
}
export function generateOccurrences(entry: Entry, fromInput: Date, toInput: Date): Occurrence[] {
  const from = utcDay(fromInput), to = utcDay(toInput), start = utcDay(entry.startDate), end = entry.endDate ? utcDay(entry.endDate) : to;
  if (afterUtc(start, to) || beforeUtc(end, from)) return [];
  const effectiveFrom = compareUtcDays(from, start) > 0 ? from : start; const out: Occurrence[] = []; const s = entry.schedule;
  if (s.frequency === 'ONCE') { pushIfInRange(out, entry, start, from, to); return out; }
  if (s.frequency === 'SEMI_MONTHLY') {
    for (let cursor = firstUtcDayOfMonth(effectiveFrom); !afterUtc(cursor, to) && !afterUtc(cursor, end); cursor = addUtcMonths(cursor, 1)) {
      pushIfInRange(out, entry, resolveMonthDay(cursor, s.dayOfMonth ?? 15), from, to);
      pushIfInRange(out, entry, resolveMonthDay(cursor, s.secondDayOfMonth ?? 'LAST'), from, to);
    }
    return out.sort((a,b)=>compareUtcDays(a.date,b.date));
  }
  if (['MONTHLY','QUARTERLY','ANNUAL'].includes(s.frequency)) {
    const step = s.frequency === 'MONTHLY' ? 1 : s.frequency === 'QUARTERLY' ? 3 : 12;
    const diffMonths = differenceInUtcMonths(effectiveFrom, start);
    const intervals = Math.max(0, Math.floor(diffMonths / step) - 1);
    for (let cursor = addUtcMonths(firstUtcDayOfMonth(start), intervals * step); !afterUtc(cursor, to) && !afterUtc(cursor, end); cursor = addUtcMonths(cursor, step)) pushIfInRange(out, entry, resolveMonthDay(cursor, s.dayOfMonth ?? start.getUTCDate()), from, to);
    return out.sort((a,b)=>compareUtcDays(a.date,b.date));
  }
  const days = s.frequency === 'WEEKLY' ? 7 : s.frequency === 'BIWEEKLY' ? 14 : Math.max(1, s.interval ?? 1);
  const diffDays = differenceInUtcDays(effectiveFrom, start);
  const intervals = Math.max(0, Math.floor(diffDays / days) - 1);
  for (let cursor = addUtcDays(start, intervals * days); !afterUtc(cursor, to) && !afterUtc(cursor, end); cursor = addUtcDays(cursor, days)) pushIfInRange(out, entry, cursor, from, to);
  return out.sort((a,b)=>compareUtcDays(a.date,b.date));
}
export const parseDate = parseDateKey;
