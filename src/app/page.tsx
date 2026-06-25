'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';

type Panel = 'overview' | 'spending' | 'recurring' | 'debt' | 'savings' | 'calendar';
type Tx = { id: string; date: string; description: string; amount: number; category: string; account: string };
type Debt = { id: string; name: string; type: 'Installment' | 'Revolving'; balance: number; apr: number; minimum: number; original?: number };
type TxDraft = { date: string; description: string; amount: string; kind: 'income' | 'expense'; category: string; account: string };

const sampleTransactions: Tx[] = [
  { id: '1', date: '2026-06-01', description: 'Payroll', amount: 4200, category: 'Income', account: 'Checking' },
  { id: '2', date: '2026-06-02', description: 'Rent', amount: -1450, category: 'Housing', account: 'Checking' },
  { id: '3', date: '2026-06-05', description: 'Grocery Store', amount: -186.42, category: 'Groceries', account: 'Credit Card' },
  { id: '4', date: '2026-06-08', description: 'Electric Utility', amount: -118.21, category: 'Utilities', account: 'Checking' },
  { id: '5', date: '2026-06-12', description: 'Streaming Service', amount: -18.99, category: 'Subscriptions', account: 'Credit Card' },
  { id: '6', date: '2026-06-15', description: 'Payroll', amount: 4200, category: 'Income', account: 'Checking' },
];

const initialDebts: Debt[] = [
  { id: 'd1', name: 'Rewards Credit Card', type: 'Revolving', balance: 3280, apr: 24.99, minimum: 110, original: 5000 },
  { id: 'd2', name: 'Auto Loan', type: 'Installment', balance: 12400, apr: 6.5, minimum: 415, original: 21000 },
];

const emptyDraft = (): TxDraft => ({
  date: new Date().toISOString().slice(0, 10),
  description: '',
  amount: '',
  kind: 'expense',
  category: '',
  account: 'Manual',
});

function money(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function parseCsv(text: string): Tx[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const find = (...names: string[]) => names.map((n) => headers.indexOf(n)).find((i) => i >= 0) ?? -1;
  const dateIndex = find('date', 'transaction date', 'posted date', 'post date');
  const descriptionIndex = find('description', 'name', 'merchant', 'payee', 'memo');
  const amountIndex = find('amount');
  const debitIndex = find('debit', 'withdrawal');
  const creditIndex = find('credit', 'deposit');
  const categoryIndex = find('category');
  const accountIndex = find('account', 'account name');

  return lines.slice(1).map((line, index) => {
    const cells = line.match(/("[^"]*"|[^,]+)/g)?.map((cell) => cell.replace(/^"|"$/g, '').trim()) ?? [];
    const debit = debitIndex >= 0 ? Number(cells[debitIndex] || 0) : 0;
    const credit = creditIndex >= 0 ? Number(cells[creditIndex] || 0) : 0;
    const rawAmount = amountIndex >= 0 ? Number(cells[amountIndex] || 0) : credit - debit;
    return {
      id: `csv-${index}-${cells[dateIndex] ?? ''}`,
      date: cells[dateIndex] || new Date().toISOString().slice(0, 10),
      description: cells[descriptionIndex] || 'Imported transaction',
      amount: Number.isFinite(rawAmount) ? rawAmount : 0,
      category: cells[categoryIndex] || categorize(cells[descriptionIndex] || '', rawAmount),
      account: cells[accountIndex] || 'Imported',
    };
  });
}

function categorize(description: string, amount: number) {
  const value = description.toLowerCase();
  if (amount > 0 || /payroll|salary|deposit/.test(value)) return 'Income';
  if (/rent|mortgage/.test(value)) return 'Housing';
  if (/grocery|market|food/.test(value)) return 'Groceries';
  if (/utility|electric|water|gas/.test(value)) return 'Utilities';
  if (/netflix|spotify|subscription|stream/.test(value)) return 'Subscriptions';
  return 'Other';
}

function toDate(value: string) {
  const [year, month, day] = value.split(/[-/]/).map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? new Date(year, month - 1, day) : new Date(value);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Dashboard() {
  const [activePanel, setActivePanel] = useState<Panel>('overview');
  const [transactions, setTransactions] = useState<Tx[]>(sampleTransactions);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [draft, setDraft] = useState<TxDraft>(() => emptyDraft());
  const [extraPayment, setExtraPayment] = useState(250);
  const [savingsGoal, setSavingsGoal] = useState(1000);

  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const expenses = Math.abs(transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
    const categories = transactions.filter((t) => t.amount < 0).reduce<Record<string, number>>((map, t) => {
      map[t.category] = (map[t.category] ?? 0) + Math.abs(t.amount);
      return map;
    }, {});
    const debtTotal = debts.reduce((sum, debt) => sum + debt.balance, 0);
    return { income, expenses, net: income - expenses, categories, debtTotal, savingsRate: income ? ((income - expenses) / income) * 100 : 0 };
  }, [debts, transactions]);

  const recurring = useMemo(() => transactions.filter((t) => /payroll|rent|utility|streaming|subscription/i.test(t.description)), [transactions]);
  const paydayPlan = useMemo(() => {
    const today = new Date();
    const incomes = transactions.filter((t) => t.amount > 0).map((t) => ({ ...t, parsedDate: toDate(t.date) })).sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
    const lastIncome = incomes.at(-1);
    const previousIncome = incomes.at(-2);
    const cadenceDays = lastIncome && previousIncome ? daysBetween(previousIncome.parsedDate, lastIncome.parsedDate) : 14;
    let nextPayday = lastIncome ? new Date(lastIncome.parsedDate) : addDays(today, cadenceDays);
    while (nextPayday <= today) nextPayday = addDays(nextPayday, cadenceDays);
    const averagePaycheck = incomes.length ? incomes.reduce((sum, income) => sum + income.amount, 0) / incomes.length : 0;
    const upcomingPaydays = Array.from({ length: 6 }, (_, index) => addDays(nextPayday, cadenceDays * index));
    const recurringExpenses = transactions.filter((t) => t.amount < 0).map((expense) => {
      const originalDate = toDate(expense.date);
      const dueDate = new Date(today.getFullYear(), today.getMonth(), originalDate.getDate());
      while (dueDate <= today) dueDate.setMonth(dueDate.getMonth() + 1);
      return { ...expense, dueDate };
    }).filter((expense) => expense.dueDate <= nextPayday);
    const billsBeforePayday = recurringExpenses.reduce((sum, expense) => sum + Math.abs(expense.amount), 0);
    const buffer = Math.max(250, averagePaycheck * 0.1);
    return {
      nextPayday,
      cadenceDays,
      averagePaycheck,
      upcomingPaydays,
      recurringExpenses,
      billsBeforePayday,
      buffer,
      safeToSpend: Math.max(0, totals.net - billsBeforePayday - buffer),
    };
  }, [totals.net, transactions]);
  const payoffMonths = Math.ceil(totals.debtTotal / Math.max(1, debts.reduce((sum, debt) => sum + debt.minimum, 0) + extraPayment));

  async function uploadCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setTransactions(parseCsv(await file.text()));
  }

  function addManualTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(draft.amount);
    if (!draft.description.trim() || !Number.isFinite(amount) || amount <= 0) return;
    const signedAmount = draft.kind === 'expense' ? -Math.abs(amount) : Math.abs(amount);
    setTransactions((current) => [{
      id: `manual-${Date.now()}`,
      date: draft.date,
      description: draft.description.trim(),
      amount: signedAmount,
      category: draft.category.trim() || categorize(draft.description, signedAmount),
      account: draft.account.trim() || 'Manual',
    }, ...current]);
    setDraft(emptyDraft());
  }

  function removeTransaction(id: string) {
    setTransactions((current) => current.filter((transaction) => transaction.id !== id));
  }

  function updateDebt(id: string, field: keyof Debt, value: string) {
    setDebts((current) => current.map((debt) => debt.id === id ? { ...debt, [field]: field === 'name' ? value : Number(value) } : debt));
  }

  return <>
    <header className="header">
      <div><h1>💰 Personal Finance Dashboard</h1><span id="header-subtitle">{transactions.length} transactions loaded — upload CSV to replace sample data</span></div>
      <nav className="tabs" aria-label="Dashboard sections">
        {(['overview', 'spending', 'recurring', 'calendar', 'debt', 'savings'] as Panel[]).map((panel) => <button key={panel} className={`tab ${activePanel === panel ? 'active' : ''}`} onClick={() => setActivePanel(panel)}>{panel === 'debt' ? 'Debt Dashboard' : panel === 'calendar' ? 'Payday Calendar' : panel[0].toUpperCase() + panel.slice(1)}</button>)}
      </nav>
    </header>

    <main>
      <section className={`panel ${activePanel === 'overview' ? 'active' : ''}`}>
        <label className="upload-area"><input type="file" accept=".csv,text/csv" onChange={uploadCsv} /><div className="upload-icon">⬆️</div><strong>Upload bank CSV</strong><div className="upload-hint">Supports Date, Description, Amount, Debit/Credit, Category, and Account columns.</div></label>
        <ManualTransactionForm draft={draft} onDraftChange={setDraft} onSubmit={addManualTransaction} />
        <div className="grid4"><Metric title="Safe to Spend" value={money(paydayPlan.safeToSpend)} good /><Metric title="Next Payday" value={formatDate(paydayPlan.nextPayday)} /><Metric title="Income" value={money(totals.income)} good /><Metric title="Expenses" value={money(totals.expenses)} warn /></div><div className="notice info">Safe to spend = current net cash flow minus estimated bills before the next payday and a {money(paydayPlan.buffer)} cushion.</div>
        <Table transactions={transactions.slice(0, 8)} onRemove={removeTransaction} />
      </section>

      <section className={`panel ${activePanel === 'spending' ? 'active' : ''}`}>
        <h2 className="section-title">Spending by Category <span className="badge">{Object.keys(totals.categories).length} categories</span></h2>
        <div className="card"><table className="tbl"><tbody>{Object.entries(totals.categories).sort((a, b) => b[1] - a[1]).map(([category, amount]) => <tr key={category}><td>{category}</td><td className="num">{money(amount)}</td><td><div className="bar-wrap"><div className="bar-track"><div className="bar-fill" style={{ width: `${totals.expenses ? (amount / totals.expenses) * 100 : 0}%`, background: 'var(--accent)' }} /></div><span className="bar-pct">{Math.round(totals.expenses ? (amount / totals.expenses) * 100 : 0)}%</span></div></td></tr>)}</tbody></table></div>
      </section>

      <section className={`panel ${activePanel === 'recurring' ? 'active' : ''}`}><h2 className="section-title">Detected Recurring Items</h2><div className="card"><Table transactions={recurring} onRemove={removeTransaction} /></div></section>

      <section className={`panel ${activePanel === 'calendar' ? 'active' : ''}`}>
        <div className="grid3"><Metric title="Safe to Spend" value={money(paydayPlan.safeToSpend)} good /><Metric title="Average Paycheck" value={money(paydayPlan.averagePaycheck)} /><Metric title="Pay Cadence" value={`${paydayPlan.cadenceDays} days`} /></div>
        <h2 className="section-title">Upcoming Paydays <span className="badge">next 6</span></h2>
        <div className="calendar-grid">{paydayPlan.upcomingPaydays.map((date, index) => <div className="calendar-day" key={date.toISOString()}><span>{index === 0 ? 'Next payday' : `Payday ${index + 1}`}</span><strong>{formatDate(date)}</strong><small>{money(paydayPlan.averagePaycheck)} expected</small></div>)}</div>
        <h2 className="section-title">Bills Before Next Payday <span className="badge">{money(paydayPlan.billsBeforePayday)}</span></h2>
        <div className="card">{paydayPlan.recurringExpenses.length ? <table className="tbl"><tbody>{paydayPlan.recurringExpenses.map((expense) => <tr key={`${expense.id}-${expense.dueDate.toISOString()}`}><td>{formatDate(expense.dueDate)}</td><td>{expense.description}</td><td>{expense.category}</td><td className="num red">{money(expense.amount)}</td></tr>)}</tbody></table> : <div className="empty-state"><div className="empty-icon">✅</div><p>No recurring bills are estimated before the next payday.</p></div>}</div>
      </section>

      <section className={`panel ${activePanel === 'debt' ? 'active' : ''}`}><div className="grid2"><Metric title="Projected Payoff" value={`${payoffMonths} months`} /><div className="card"><label>Extra monthly payment</label><input type="number" value={extraPayment} onChange={(e) => setExtraPayment(Number(e.target.value))} /></div></div>{debts.map((debt) => <div className="debt-card confirmed" key={debt.id}><div className="debt-header"><div><input value={debt.name} onChange={(e) => updateDebt(debt.id, 'name', e.target.value)} /><div className="debt-type">{debt.type}</div></div><span className={`debt-badge ${debt.type === 'Installment' ? 'installment' : 'revolving'}`}>{debt.type}</span></div><div className="debt-grid"><Field label="Balance" value={debt.balance} onChange={(v) => updateDebt(debt.id, 'balance', v)} /><Field label="APR %" value={debt.apr} onChange={(v) => updateDebt(debt.id, 'apr', v)} /><Field label="Minimum" value={debt.minimum} onChange={(v) => updateDebt(debt.id, 'minimum', v)} /></div><div className="payoff-bar"><div className="payoff-bar-track"><div className="payoff-bar-fill" style={{ width: `${Math.min(100, 100 - (debt.balance / (debt.original ?? debt.balance)) * 100)}%` }} /></div><div className="payoff-label"><span>Paid off</span><span>{money(debt.balance)} remaining</span></div></div></div>)}</section>

      <section className={`panel ${activePanel === 'savings' ? 'active' : ''}`}><div className="grid3"><Metric title="Savings Rate" value={`${totals.savingsRate.toFixed(1)}%`} good={totals.savingsRate >= 20} /><div className="card"><label>Monthly goal</label><input type="number" value={savingsGoal} onChange={(e) => setSavingsGoal(Number(e.target.value))} /></div><Metric title="Goal Progress" value={`${Math.min(100, (Math.max(0, totals.net) / savingsGoal) * 100).toFixed(0)}%`} /></div><p className="notice info">Savings equals income minus expenses for the currently loaded CSV period.</p></section>
    </main>
  </>;
}

function ManualTransactionForm({ draft, onDraftChange, onSubmit }: { draft: TxDraft; onDraftChange: (draft: TxDraft) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="card form manual-form" onSubmit={onSubmit}>
    <h2 className="form-title">Add Income or Expense</h2>
    <label>Date<input type="date" value={draft.date} onChange={(event) => onDraftChange({ ...draft, date: event.target.value })} /></label>
    <label>Description<input type="text" value={draft.description} onChange={(event) => onDraftChange({ ...draft, description: event.target.value })} placeholder="Paycheck, rent, groceries..." required /></label>
    <label>Type<select value={draft.kind} onChange={(event) => onDraftChange({ ...draft, kind: event.target.value as TxDraft['kind'] })}><option value="income">Income</option><option value="expense">Expense</option></select></label>
    <label>Amount<input type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => onDraftChange({ ...draft, amount: event.target.value })} placeholder="0.00" required /></label>
    <label>Category<input type="text" value={draft.category} onChange={(event) => onDraftChange({ ...draft, category: event.target.value })} placeholder="Auto-detect if blank" /></label>
    <label>Account<input type="text" value={draft.account} onChange={(event) => onDraftChange({ ...draft, account: event.target.value })} placeholder="Checking" /></label>
    <button className="btn" type="submit">Add transaction</button>
  </form>;
}

function Metric({ title, value, warn, good }: { title: string; value: string; warn?: boolean; good?: boolean }) {
  return <div className={`card ${warn ? 'card-warn' : ''} ${good ? 'card-good' : ''}`}><div className="card-title">{title}</div><div className="card-value">{value}</div></div>;
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <div className="debt-field"><label>{label}</label><input type="number" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function Table({ transactions, onRemove }: { transactions: Tx[]; onRemove?: (id: string) => void }) {
  if (!transactions.length) return <div className="empty-state"><div className="empty-icon">📭</div><p>No matching transactions.</p></div>;
  return <div className="card"><table className="tbl"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th className="num">Amount</th>{onRemove ? <th className="num">Actions</th> : null}</tr></thead><tbody>{transactions.map((t) => <tr key={t.id}><td>{t.date}</td><td>{t.description}</td><td>{t.category}</td><td>{t.account}</td><td className={`num ${t.amount < 0 ? 'red' : 'grn'}`}>{money(t.amount)}</td>{onRemove ? <td className="num"><button className="link-btn" type="button" onClick={() => onRemove(t.id)}>Remove</button></td> : null}</tr>)}</tbody></table></div>;
}

export default function Home() { return <Dashboard />; }
