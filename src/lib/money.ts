export const dollarsToCents = (value: string | number) => Math.round(Number(value) * 100);
export const centsToDollars = (cents: number) => cents / 100;
export const formatMoney = (cents: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
