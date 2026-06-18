# SafeSpend Budget

A single-user, multi-device personal finance app: recurring income/expense tracker, cash-flow calendar, safe-to-spend calculator, accounts, and debt payoff planner.

## Stack choice

- **Next.js App Router + React + TypeScript** for a type-safe mobile web app deployable to Vercel.
- **Prisma + Postgres** for hosted persistence.
- **date-fns** for deterministic date and month-boundary logic.
- **Integer cents** for all money storage and calculations.

## Run locally

```bash
npm install
vercel env pull .env
npm run db:deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000.

## Initial data upload

Use the **Initial data upload** form to upload one or more bank statement CSV or text-based PDF files. CSV imports support common headers:

- Date: `Date`, `Transaction Date`, `Posted Date`, or `Post Date`
- Description: `Description`, `Name`, `Merchant`, `Payee`, or `Memo`
- Amount: `Amount`, or separate `Debit` / `Credit` columns
- Optional: `Category`, `Account`, or `Account Name`

Positive amounts become income, negative amounts become expenses. Uploaded transactions are imported as one-time entries; recurring bills and paychecks still need to be reviewed or entered manually.

PDF support currently targets text-based Capital One bank statements with transaction tables in `DATE DESCRIPTION CATEGORY AMOUNT BALANCE` format.

After multiple months of statements are uploaded, the app scans one-time imported transactions for recurring patterns. Matching items appear under **Detected recurring items** with cadence, amount, and confidence. Accepting a suggestion creates a recurring entry; internal transfers are ignored by the detector.

## Commands

- `npm run dev` - generate the Prisma client, then start the local app
- `npm run build` - generate the Prisma client, then create a production build
- `npm run test` - recurrence, safe-to-spend, and debt math tests
- `npm run db:deploy` - apply committed Prisma migrations and regenerate `@prisma/client`
- `npm run db:generate` - regenerate `@prisma/client` after schema changes
- `npm run db:seed` - load realistic sample data
- `npm run db:wipe` - clear all data

## Deploy

Deploy to Vercel or another Node host. Use hosted Postgres (Neon/Supabase/Vercel Postgres), set `DATABASE_URL`, then run Prisma migrations before deploy.

## Deferred integration points

- **Plaid bank linking:** `src/providers/bank.ts` defines `BankDataProvider`; the current manual provider returns no external data. To activate Plaid, add Link token creation, store item access tokens in `BankConnection`, implement provider methods, and add a webhook route.
- **Statement import:** `src/import/pipeline.ts` defines parse → normalize → categorize → reconcile. CSV/PDF parsers can implement `StatementImporter` without changing forecast logic.
- **Savings goals:** Prisma includes `Goal` with user/account relationships. UI is intentionally deferred.

See `ARCHITECTURE.md` for computation and adapter details.


## Troubleshooting

If Next.js reports `Cannot find module .prisma/client/default`, the generated Prisma client is missing. Run `npm run db:generate` or restart with `npm run dev`; `postinstall`, `dev`, and `build` all generate the client automatically.
