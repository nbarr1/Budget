import type { Entry, Frequency } from './types';

export type RecurringCandidate = {
  key: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  accountId: string;
  amountCents: number;
  frequency: Exclude<Frequency, 'ONCE' | 'CUSTOM' | 'ANNUAL' | 'QUARTERLY'>;
  startDate: Date;
  isVariable: boolean;
  confidence: number;
  occurrences: number;
};

function merchantKey(name: string) {
  return name
    .toLowerCase()
    .replace(/x{3,}\d*/g, '')
    .replace(/\b\d{2,}\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(debit|card|purchase|digital|withdrawal|from|to|payment|pmt|ach|tran|inc|com|llc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function inferFrequency(intervals: number[]) {
  if (!intervals.length) return null;
  const avg = average(intervals);
  if (Math.abs(avg - 7) <= 2) return 'WEEKLY';
  if (Math.abs(avg - 14) <= 3) return 'BIWEEKLY';
  if (Math.abs(avg - 15) <= 3) return 'SEMI_MONTHLY';
  if (Math.abs(avg - 30) <= 6) return 'MONTHLY';
  return null;
}

export function detectRecurringCandidates(entries: Entry[]): RecurringCandidate[] {
  const groups = new Map<string, Entry[]>();
  const accepted = new Set(
    entries
      .filter((entry) => entry.schedule.frequency !== 'ONCE')
      .map((entry) => [entry.accountId, entry.type, merchantKey(entry.name), entry.category].join('|')),
  );
  for (const entry of entries) {
    if (entry.schedule.frequency !== 'ONCE') continue;
    if (entry.category === 'Transfer') continue;
    const key = [entry.accountId, entry.type, merchantKey(entry.name), entry.category].join('|');
    if (accepted.has(key)) continue;
    if (key.endsWith('||')) continue;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const candidates: RecurringCandidate[] = [];
  for (const [key, group] of groups) {
    const sorted = group.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    if (sorted.length < 3) continue;

    const intervals = sorted.slice(1).map((entry, index) => daysBetween(sorted[index].startDate, entry.startDate));
    const frequency = inferFrequency(intervals);
    if (!frequency) continue;

    const amounts = sorted.map((entry) => entry.amountCents);
    const amountCents = median(amounts);
    const averageAmount = average(amounts);
    const maxVariance = Math.max(...amounts.map((amount) => Math.abs(amount - averageAmount)));
    const varianceRatio = averageAmount ? maxVariance / averageAmount : 0;
    const intervalScore = Math.max(0, 1 - average(intervals.map((interval) => Math.abs(interval - average(intervals)))) / 10);
    const amountScore = Math.max(0, 1 - Math.min(varianceRatio, 1));
    const confidence = Math.round((0.65 * intervalScore + 0.35 * amountScore) * 100);
    if (confidence < 55) continue;

    const latest = sorted[sorted.length - 1];
    candidates.push({
      key,
      name: latest.name,
      type: latest.type,
      category: latest.category,
      accountId: latest.accountId,
      amountCents,
      frequency,
      startDate: sorted[0].startDate,
      isVariable: varianceRatio > 0.1,
      confidence,
      occurrences: sorted.length,
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}
