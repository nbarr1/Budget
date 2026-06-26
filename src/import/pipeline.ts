import { prisma } from '../lib/db';
import { dayKey, parseDateKey } from '../lib/dates';

export type RawImport = { fileName: string; mimeType: string; bytes: Uint8Array };
export type NormalizedTransaction = {
  date: string;
  name: string;
  amountCents: number;
  accountHint?: string;
  category?: string;
};

export interface StatementImporter {
  parse(raw: RawImport): Promise<unknown[]>;
  normalize(rows: unknown[]): Promise<NormalizedTransaction[]>;
  categorize(txns: NormalizedTransaction[]): Promise<NormalizedTransaction[]>;
  reconcile(userId: string, txns: NormalizedTransaction[]): Promise<{ created: number; matched: number }>;
}

type CsvRow = Record<string, string>;
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthPattern = months.join('|');

const headerAliases = {
  date: ['date', 'transaction date', 'posted date', 'post date'],
  name: ['description', 'name', 'merchant', 'payee', 'memo'],
  amount: ['amount', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'charge'],
  credit: ['credit', 'deposit', 'deposits'],
  transactionType: ['debit/credit', 'debit credit', 'transaction type', 'type'],
  category: ['category'],
  account: ['account', 'account name'],
};

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  const [headers = [], ...data] = rows;
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  return data.map((values) =>
    Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index]?.trim() ?? ''])),
  );
}

function statementYear(text: string) {
  const match = text.match(new RegExp(`(?:${monthPattern})\\s+\\d{1,2}\\s+-\\s+(?:${monthPattern})\\s+\\d{1,2},\\s+(\\d{4})`));
  return match?.[1] ?? String(new Date().getUTCFullYear());
}

function accountType(accountName: string) {
  return accountName.toLowerCase().includes('saving') ? 'savings' : 'checking';
}

function parseMoney(value: string) {
  return Number(value.replace(/[$,]/g, ''));
}

function parsePdfTransactions(text: string): CsvRow[] {
  const year = statementYear(text);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: CsvRow[] = [];
  let account = 'Imported Account';
  let inTransactions = false;
  let pending = '';

  const accountHeader = /^(.+?)\s+-\s+\S+$/;
  const startsTransaction = new RegExp(`^(?:${monthPattern})\\s+\\d{1,2}\\s+`);
  const completedTransaction = new RegExp(`^((?:${monthPattern})\\s+\\d{1,2})\\s+(.+?)\\s+(Debit|Credit)\\s+([+-])\\s+\\$([\\d,]+\\.\\d{2})\\s+\\$[\\d,]+\\.\\d{2}$`);

  function flush() {
    const normalized = pending.replace(/\s+/g, ' ').trim();
    pending = '';
    const match = normalized.match(completedTransaction);
    if (!match) return;
    const [, datePart, description, kind, sign, dollars] = match;
    const amount = parseMoney(dollars);
    const signedAmount = kind === 'Credit' || sign === '+' ? amount : -amount;
    const [monthName, day] = datePart.split(' ');
    const month = String(months.indexOf(monthName) + 1).padStart(2, '0');
    rows.push({
      date: `${year}-${month}-${day.padStart(2, '0')}`,
      description,
      amount: signedAmount.toFixed(2),
      account,
    });
  }

  for (const line of lines) {
    const accountMatch = line.match(accountHeader);
    if (accountMatch && !line.includes('XXXX')) {
      flush();
      account = accountMatch[1];
      inTransactions = false;
      continue;
    }

    if (line === 'DATE DESCRIPTION CATEGORY AMOUNT BALANCE') {
      flush();
      inTransactions = true;
      continue;
    }

    if (!inTransactions || /^Page \d+ of \d+$|^-- \d+ of \d+ --$|^STATEMENT PERIOD$|^capitalone\.com/.test(line)) continue;
    if (/^(Opening|Closing) Balance\b/.test(line.replace(new RegExp(`^(?:${monthPattern})\\s+\\d{1,2}\\s+`), ''))) continue;

    if (startsTransaction.test(line)) flush();
    pending = pending ? `${pending} ${line}` : line;
    if (completedTransaction.test(pending.replace(/\s+/g, ' ').trim())) flush();
  }
  flush();

  return rows;
}

function value(row: CsvRow, aliases: string[]) {
  for (const alias of aliases) {
    const found = row[alias];
    if (found) return found;
  }
  return '';
}

function amountToCents(input: string) {
  const cleaned = input.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function applyDebitCreditSign(amountCents: number | null, kind: string) {
  if (amountCents == null) return null;
  const normalizedKind = kind.trim().toLowerCase();
  if (/^(debit|withdrawal|charge|expense)$/.test(normalizedKind)) return -Math.abs(amountCents);
  if (/^(credit|deposit|income)$/.test(normalizedKind)) return Math.abs(amountCents);
  return amountCents;
}

function normalizeDate(input: string) {
  const value = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return dayKey(parsed);
  throw new Error(`Unsupported transaction date: ${input}`);
}

function categorize(name: string, fallback?: string) {
  if (fallback) return fallback;
  const text = name.toLowerCase();
  if (/transfer|withdrawal to 360|deposit from 360|deposit from my savings|withdrawal to my savings/.test(text)) return 'Transfer';
  if (/payroll|paycheck|salary|direct dep|deposit/.test(text)) return 'Job';
  if (/rent|mortgage/.test(text)) return 'Housing';
  if (/grocery|market|trader joe|whole foods|kroger|aldi/.test(text)) return 'Food';
  if (/electric|utility|water|gas bill|internet|phone/.test(text)) return 'Bills';
  if (/insurance/.test(text)) return 'Insurance';
  if (/restaurant|coffee|doordash|uber eats/.test(text)) return 'Dining';
  if (/gas|fuel|shell|chevron|exxon/.test(text)) return 'Transportation';
  return 'General';
}

async function ensurePdfCanvasGlobals() {
  const { DOMMatrix, ImageData, Path2D } = await import('@napi-rs/canvas');
  const globals = globalThis as Record<string, unknown>;
  globals.DOMMatrix ??= DOMMatrix;
  globals.ImageData ??= ImageData;
  globals.Path2D ??= Path2D;
}

export class CsvStatementImporter implements StatementImporter {
  async parse(raw: RawImport) {
    if (raw.mimeType === 'application/pdf' || raw.fileName.toLowerCase().endsWith('.pdf')) {
      await ensurePdfCanvasGlobals();
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: Buffer.from(raw.bytes) });
      try {
        const result = await parser.getText();
        return parsePdfTransactions(result.text);
      } finally {
        await parser.destroy();
      }
    }

    const text = new TextDecoder().decode(raw.bytes);
    return parseCsv(text);
  }

  async normalize(rows: unknown[]) {
    return (rows as CsvRow[]).flatMap((row) => {
      const date = value(row, headerAliases.date);
      const name = value(row, headerAliases.name);
      const amount = amountToCents(value(row, headerAliases.amount));
      const amountKind = value(row, headerAliases.transactionType);
      const debit = amountToCents(value(row, headerAliases.debit));
      const credit = amountToCents(value(row, headerAliases.credit));
      const amountCents = applyDebitCreditSign(amount, amountKind) ?? (credit ?? 0) - (debit ?? 0);
      if (!date || !name || amountCents === 0) return [];
      return {
        date,
        name,
        amountCents,
        accountHint: value(row, headerAliases.account) || undefined,
        category: value(row, headerAliases.category) || undefined,
      };
    });
  }

  async categorize(txns: NormalizedTransaction[]) {
    return txns.map((txn) => ({ ...txn, category: categorize(txn.name, txn.category) }));
  }

  async reconcile(userId: string, txns: NormalizedTransaction[]) {
    let created = 0;
    let matched = 0;
    const accountIds = new Map<string, string>();

    for (const txn of txns) {
      const accountName = txn.accountHint ?? 'Imported Account';
      let accountId = accountIds.get(accountName);
      if (!accountId) {
        const account =
          (await prisma.account.findFirst({ where: { userId, name: accountName } })) ??
          (await prisma.account.create({ data: { userId, name: accountName, type: accountType(accountName) } }));
        accountId = account.id;
        accountIds.set(accountName, accountId);
      }

      const startDate = parseDateKey(normalizeDate(txn.date));
      const existing = await prisma.entry.findFirst({
        where: {
          userId,
          accountId,
          name: txn.name,
          amountCents: Math.abs(txn.amountCents),
          startDate,
          scheduleJson: JSON.stringify({ frequency: 'ONCE' }),
        },
      });

      if (existing) {
        matched++;
        continue;
      }

      await prisma.entry.create({
        data: {
          userId,
          accountId,
          name: txn.name,
          type: txn.amountCents > 0 ? 'INCOME' : 'EXPENSE',
          amountCents: Math.abs(txn.amountCents),
          category: txn.category ?? 'General',
          scheduleJson: JSON.stringify({ frequency: 'ONCE' }),
          startDate,
          isVariable: true,
        },
      });
      created++;
    }

    return { created, matched };
  }
}

export async function importStatement(userId: string, raw: RawImport) {
  const importer = new CsvStatementImporter();
  const rows = await importer.parse(raw);
  const normalized = await importer.normalize(rows);
  const categorized = await importer.categorize(normalized);
  return importer.reconcile(userId, categorized);
}
