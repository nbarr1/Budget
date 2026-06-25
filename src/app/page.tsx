'use client';

import { ChangeEvent, useMemo, useState } from 'react';

type Panel = 'overview' | 'spending' | 'recurring' | 'debt' | 'savings';
type Tx = { id: string; date: string; description: string; amount: number; category: string; account: string };
type Debt = { id: string; name: string; type: 'Installment' | 'Revolving'; balance: number; apr: number; minimum: number; original?: number };

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

function Dashboard() {
  const [activePanel, setActivePanel] = useState<Panel>('overview');
  const [transactions, setTransactions] = useState<Tx[]>(sampleTransactions);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
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
  const payoffMonths = Math.ceil(totals.debtTotal / Math.max(1, debts.reduce((sum, debt) => sum + debt.minimum, 0) + extraPayment));

  async function uploadCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setTransactions(parseCsv(await file.text()));
  }

  function updateDebt(id: string, field: keyof Debt, value: string) {
    setDebts((current) => current.map((debt) => debt.id === id ? { ...debt, [field]: field === 'name' ? value : Number(value) } : debt));
  }

  return <>
    <header className="header">
      <div><h1>💰 Personal Finance Dashboard</h1><span id="header-subtitle">{transactions.length} transactions loaded — upload CSV to replace sample data</span></div>
      <nav className="tabs" aria-label="Dashboard sections">
        {(['overview', 'spending', 'recurring', 'debt', 'savings'] as Panel[]).map((panel) => <button key={panel} className={`tab ${activePanel === panel ? 'active' : ''}`} onClick={() => setActivePanel(panel)}>{panel === 'debt' ? 'Debt Dashboard' : panel[0].toUpperCase() + panel.slice(1)}</button>)}
      </nav>
    </header>

    <main>
      <section className={`panel ${activePanel === 'overview' ? 'active' : ''}`}>
        <label className="upload-area"><input type="file" accept=".csv,text/csv" onChange={uploadCsv} /><div className="upload-icon">⬆️</div><strong>Upload bank CSV</strong><div className="upload-hint">Supports Date, Description, Amount, Debit/Credit, Category, and Account columns.</div></label>
        <div className="grid4"><Metric title="Income" value={money(totals.income)} good /><Metric title="Expenses" value={money(totals.expenses)} warn /><Metric title="Net Cash Flow" value={money(totals.net)} good={totals.net >= 0} /><Metric title="Debt Balance" value={money(totals.debtTotal)} /></div>
        <Table transactions={transactions.slice(0, 8)} />
      </section>

      <section className={`panel ${activePanel === 'spending' ? 'active' : ''}`}>
        <h2 className="section-title">Spending by Category <span className="badge">{Object.keys(totals.categories).length} categories</span></h2>
        <div className="card"><table className="tbl"><tbody>{Object.entries(totals.categories).sort((a, b) => b[1] - a[1]).map(([category, amount]) => <tr key={category}><td>{category}</td><td className="num">{money(amount)}</td><td><div className="bar-wrap"><div className="bar-track"><div className="bar-fill" style={{ width: `${(amount / totals.expenses) * 100}%`, background: 'var(--accent)' }} /></div><span className="bar-pct">{Math.round((amount / totals.expenses) * 100)}%</span></div></td></tr>)}</tbody></table></div>
      </section>

      <section className={`panel ${activePanel === 'recurring' ? 'active' : ''}`}><h2 className="section-title">Detected Recurring Items</h2><div className="card"><Table transactions={recurring} /></div></section>

      <section className={`panel ${activePanel === 'debt' ? 'active' : ''}`}><div className="grid2"><Metric title="Projected Payoff" value={`${payoffMonths} months`} /><div className="card"><label>Extra monthly payment</label><input type="number" value={extraPayment} onChange={(e) => setExtraPayment(Number(e.target.value))} /></div></div>{debts.map((debt) => <div className="debt-card confirmed" key={debt.id}><div className="debt-header"><div><input value={debt.name} onChange={(e) => updateDebt(debt.id, 'name', e.target.value)} /><div className="debt-type">{debt.type}</div></div><span className={`debt-badge ${debt.type === 'Installment' ? 'installment' : 'revolving'}`}>{debt.type}</span></div><div className="debt-grid"><Field label="Balance" value={debt.balance} onChange={(v) => updateDebt(debt.id, 'balance', v)} /><Field label="APR %" value={debt.apr} onChange={(v) => updateDebt(debt.id, 'apr', v)} /><Field label="Minimum" value={debt.minimum} onChange={(v) => updateDebt(debt.id, 'minimum', v)} /></div><div className="payoff-bar"><div className="payoff-bar-track"><div className="payoff-bar-fill" style={{ width: `${Math.min(100, 100 - (debt.balance / (debt.original ?? debt.balance)) * 100)}%` }} /></div><div className="payoff-label"><span>Paid off</span><span>{money(debt.balance)} remaining</span></div></div></div>)}</section>

      <section className={`panel ${activePanel === 'savings' ? 'active' : ''}`}><div className="grid3"><Metric title="Savings Rate" value={`${totals.savingsRate.toFixed(1)}%`} good={totals.savingsRate >= 20} /><div className="card"><label>Monthly goal</label><input type="number" value={savingsGoal} onChange={(e) => setSavingsGoal(Number(e.target.value))} /></div><Metric title="Goal Progress" value={`${Math.min(100, (Math.max(0, totals.net) / savingsGoal) * 100).toFixed(0)}%`} /></div><p className="notice info">Savings equals income minus expenses for the currently loaded CSV period.</p></section>
    </main>
  </>;
}

function Metric({ title, value, warn, good }: { title: string; value: string; warn?: boolean; good?: boolean }) {
  return <div className={`card ${warn ? 'card-warn' : ''} ${good ? 'card-good' : ''}`}><div className="card-title">{title}</div><div className="card-value">{value}</div></div>;
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <div className="debt-field"><label>{label}</label><input type="number" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function Table({ transactions }: { transactions: Tx[] }) {
  if (!transactions.length) return <div className="empty-state"><div className="empty-icon">📭</div><p>No matching transactions.</p></div>;
  return <div className="card"><table className="tbl"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th className="num">Amount</th></tr></thead><tbody>{transactions.map((t) => <tr key={t.id}><td>{t.date}</td><td>{t.description}</td><td>{t.category}</td><td>{t.account}</td><td className={`num ${t.amount < 0 ? 'red' : 'grn'}`}>{money(t.amount)}</td></tr>)}</tbody></table></div>;
}

export default function Home() { return <Dashboard />; }
