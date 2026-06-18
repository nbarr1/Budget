import type { Account, Entry, Occurrence } from './types';
import { generateOccurrences } from './recurrence';
import { addUtcDays, compareUtcDays, dayKey, onOrBeforeUtc, utcDay } from './dates';
export type DayProjection = { date: Date; startingBalanceCents:number; incomeCents:number; expenseCents:number; endingBalanceCents:number; events: Occurrence[] };
export function getOccurrences(entries: Entry[], from: Date, to: Date, accountId?: string) { return entries.flatMap(e => accountId && e.accountId !== accountId ? [] : generateOccurrences(e, from, to)).sort((a,b)=>compareUtcDays(a.date,b.date)); }
export function projectCashFlow(accounts: Account[], entries: Entry[], from: Date, to: Date, accountId?: string): DayProjection[] {
  let bal = accounts.filter(a=>!accountId || a.id===accountId).reduce((s,a)=>s+a.balanceCents,0); const events = getOccurrences(entries, from, to, accountId); const days: DayProjection[]=[];
  const eventsByDate: Record<string, Occurrence[]> = {};
  for (const event of events) (eventsByDate[dayKey(event.date)] ??= []).push(event);
  for(let d=utcDay(from); onOrBeforeUtc(d, to); d=addUtcDays(d,1)){ const todays=eventsByDate[dayKey(d)] ?? []; const income=todays.filter(e=>e.type==='INCOME').reduce((s,e)=>s+e.amountCents,0); const expense=todays.filter(e=>e.type==='EXPENSE').reduce((s,e)=>s+e.amountCents,0); const start=bal; bal += income - expense; days.push({date:d,startingBalanceCents:start,incomeCents:income,expenseCents:expense,endingBalanceCents:bal,events:todays}); }
  return days;
}
export function computeSafeToSpend(accounts: Account[], entries: Entry[], bufferCents: number, today: Date, horizonDays = 90, accountId?: string) {
  const to = addUtcDays(today, horizonDays); const occ = getOccurrences(entries, today, to, accountId); const nextPayday = occ.find(o=>o.type==='INCOME')?.date ?? null; const until = nextPayday ?? to;
  const bills = occ.filter(o=>o.type==='EXPENSE' && onOrBeforeUtc(o.date, until)).reduce((s,o)=>s+o.amountCents,0); const current = accounts.filter(a=>!accountId || a.id===accountId).reduce((s,a)=>s+a.balanceCents,0); const safe = current - bills - bufferCents;
  return { currentProjectedBalanceCents: current, nextPaydayDate: nextPayday, billsBeforePaydayCents: bills, bufferCents, safeToSpendCents: safe, consideredEvents: occ.filter(o=>onOrBeforeUtc(o.date, until)) };
}
