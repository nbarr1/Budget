# Personal Finance Dashboard

A simplified, browser-only finance dashboard for reviewing CSV bank exports. The app focuses on the functionality in the provided HTML mockup: overview metrics, spending categories, recurring transaction review, debt payoff inputs, and savings progress.

## What it does

- Loads sample transactions on first visit.
- Replaces sample data with an uploaded CSV in the browser.
- Supports common CSV columns: `Date`, `Transaction Date`, `Posted Date`, `Description`, `Name`, `Merchant`, `Amount`, `Debit`, `Credit`, `Category`, `Account`, and `Account Name`.
- Calculates income, expenses, net cash flow, category percentages, debt totals, payoff estimate, and savings rate.
- Keeps all data local to the current browser session; no database or login is required.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Commands

- `npm run dev` - start the Next.js development server.
- `npm run build` - create a production build.
- `npm run test` - run the remaining core calculation tests.

## Notes

The repository still includes legacy domain modules and Prisma files for reference, but the user-facing app has been simplified to a static dashboard that matches the uploaded HTML dashboard purpose.
