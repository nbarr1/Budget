export type BankAccountSnapshot={externalId:string;name:string;type:string;balanceCents:number};
export type BankTransaction={externalId:string;accountExternalId:string;date:string;name:string;amountCents:number;category?:string};
export interface BankDataProvider{ fetchAccounts(userId:string):Promise<BankAccountSnapshot[]>; fetchBalances(userId:string):Promise<BankAccountSnapshot[]>; fetchTransactions(userId:string,from:string,to:string):Promise<BankTransaction[]>; }
export class ManualBankDataProvider implements BankDataProvider{ async fetchAccounts(){return []} async fetchBalances(){return []} async fetchTransactions(){return []} }
// Plaid integration point: implement BankDataProvider using Plaid Link tokens, item access tokens, and webhooks without changing app forecasting logic.
