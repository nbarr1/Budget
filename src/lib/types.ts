export type EntryType = 'INCOME' | 'EXPENSE';
export type Frequency = 'ONCE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'SEMI_MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM';
export type Schedule = { frequency: Frequency; interval?: number; dayOfMonth?: number | 'LAST'; secondDayOfMonth?: number | 'LAST' };
export type Entry = { id:string; name:string; type:EntryType; amountCents:number; category:string; accountId:string; schedule:Schedule; startDate:Date; endDate?:Date|null; notes?:string|null; isAuto:boolean; isVariable:boolean; skippedDates?: string[] };
export type Account = { id:string; name:string; type:string; balanceCents:number };
export type Occurrence = { id:string; entryId:string; name:string; type:EntryType; amountCents:number; date:Date; category:string; accountId:string; isAuto:boolean; isVariable:boolean };
export type Debt = { id:string; name:string; balanceCents:number; aprBps:number; minimumPaymentCents:number; dueDay:number };
