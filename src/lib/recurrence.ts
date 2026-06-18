import { addDays, addMonths, addWeeks, compareAsc, endOfMonth, formatISO, isAfter, isBefore, isEqual, max, parseISO, setDate, startOfDay } from 'date-fns';
import type { Entry, Occurrence } from './types';

const dayKey = (d: Date) => formatISO(startOfDay(d), { representation: 'date' });
export function resolveMonthDay(monthDate: Date, day?: number | 'LAST') {
  const end = endOfMonth(monthDate).getDate();
  const d = day === 'LAST' || day == null ? end : Math.min(day, end);
  return startOfDay(setDate(monthDate, d));
}
function pushIfInRange(out: Occurrence[], entry: Entry, date: Date, from: Date, to: Date) {
  const d = startOfDay(date); const skips = new Set(entry.skippedDates ?? []);
  if ((isEqual(d, from) || isAfter(d, from)) && (isEqual(d, to) || isBefore(d, to)) && !skips.has(dayKey(d))) {
    out.push({ id: `${entry.id}:${dayKey(d)}`, entryId: entry.id, name: entry.name, type: entry.type, amountCents: entry.amountCents, date: d, category: entry.category, accountId: entry.accountId, isAuto: entry.isAuto, isVariable: entry.isVariable });
  }
}
export function generateOccurrences(entry: Entry, fromInput: Date, toInput: Date): Occurrence[] {
  const from = startOfDay(fromInput), to = startOfDay(toInput), start = startOfDay(entry.startDate), end = entry.endDate ? startOfDay(entry.endDate) : to;
  if (isAfter(start, to) || isBefore(end, from)) return [];
  const effectiveFrom = max([from, start]); const out: Occurrence[] = []; const s = entry.schedule;
  if (s.frequency === 'ONCE') { pushIfInRange(out, entry, start, from, to); return out; }
  if (s.frequency === 'SEMI_MONTHLY') {
    for (let cursor = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1); !isAfter(cursor, to) && !isAfter(cursor, end); cursor = addMonths(cursor, 1)) {
      pushIfInRange(out, entry, resolveMonthDay(cursor, s.dayOfMonth ?? 15), from, to);
      pushIfInRange(out, entry, resolveMonthDay(cursor, s.secondDayOfMonth ?? 'LAST'), from, to);
    }
    return out.sort((a,b)=>compareAsc(a.date,b.date));
  }
  if (['MONTHLY','QUARTERLY','ANNUAL'].includes(s.frequency)) {
    const step = s.frequency === 'MONTHLY' ? 1 : s.frequency === 'QUARTERLY' ? 3 : 12;
    for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); !isAfter(cursor, to) && !isAfter(cursor, end); cursor = addMonths(cursor, step)) pushIfInRange(out, entry, resolveMonthDay(cursor, s.dayOfMonth ?? start.getDate()), from, to);
    return out.sort((a,b)=>compareAsc(a.date,b.date));
  }
  const days = s.frequency === 'WEEKLY' ? 7 : s.frequency === 'BIWEEKLY' ? 14 : (s.interval ?? 1);
  for (let cursor = start; !isAfter(cursor, to) && !isAfter(cursor, end); cursor = addDays(cursor, days)) pushIfInRange(out, entry, cursor, from, to);
  return out.sort((a,b)=>compareAsc(a.date,b.date));
}
export const parseDate = (s: string) => parseISO(s + 'T00:00:00');
