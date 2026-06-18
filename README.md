# SafeSpend Budget

A single-user, multi-device personal finance app: recurring income/expense tracker, cash-flow calendar, safe-to-spend calculator, accounts, and debt payoff planner.

## Stack choice

- **Next.js App Router + React + TypeScript** for a type-safe mobile web app deployable to Vercel.
- **Prisma + Postgres** for production hosted persistence; local development can use SQLite via `DATABASE_URL=file:./dev.db`.
- **date-fns** for deterministic date and month-boundary logic.
- **Integer cents** for all money storage and calculations.

## Run locally

```bash
cp .env.example .env
npm install
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Open http://localhost:3000 and sign in with `APP_PASSWORD` from `.env`.

## Commands

- `npm run dev` - generate the Prisma client, then start the local app
- `npm run build` - generate the Prisma client, then create a production build
- `npm run test` - recurrence, safe-to-spend, and debt math tests
- `npm run db:generate` - regenerate `@prisma/client` after schema changes
- `npm run db:seed` - load realistic sample data
- `npm run db:wipe` - clear all data

## Deploy

Deploy to Vercel or another Node host. Use hosted Postgres (Neon/Supabase/Vercel Postgres), set `DATABASE_URL`, `APP_PASSWORD`, and `AUTH_SECRET`, then run Prisma migrations during deploy.

## Deferred integration points

- **Plaid bank linking:** `src/providers/bank.ts` defines `BankDataProvider`; the current manual provider returns no external data. To activate Plaid, add Link token creation, store item access tokens in `BankConnection`, implement provider methods, and add a webhook route.
- **Statement import:** `src/import/pipeline.ts` defines parse → normalize → categorize → reconcile. CSV/PDF parsers can implement `StatementImporter` without changing forecast logic.
- **Savings goals:** Prisma includes `Goal` with user/account relationships. UI is intentionally deferred.

See `ARCHITECTURE.md` for computation and adapter details.


## Troubleshooting

If Next.js reports `Cannot find module .prisma/client/default`, the generated Prisma client is missing. Run `npm run db:generate` or restart with `npm run dev`; `postinstall`, `dev`, and `build` all generate the client automatically.
