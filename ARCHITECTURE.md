# Architecture

`src/lib/recurrence.ts`, `src/lib/forecast.ts`, and `src/lib/debt.ts` are the core single-source-of-truth modules. The UI calls the same forecast functions for the home hero, agenda, calendar projection, and safe-to-spend math so values cannot drift.

All persisted money is integer cents. Recurring entries store compact schedule JSON and future occurrences are computed on demand rather than materialized. Skipped single dates are represented by ISO date keys on an entry.

Provider seams:

- `BankDataProvider` in `src/providers/bank.ts` isolates future Plaid account/balance/transaction sync.
- `StatementImporter` in `src/import/pipeline.ts` isolates statement parsing, normalization, categorization, and reconciliation.
- `Goal` exists in the data model but has no UI yet.
