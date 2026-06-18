import type { Debt } from './types';
export type Strategy='snowball'|'avalanche';
export function simulateDebtPayoff(debts: Debt[], strategy: Strategy, extraMonthlyCents=0, lumpSumCents=0) {
  let rows = debts.map(d=>({...d,balanceCents:d.balanceCents})); let month=0,totalInterest=0; const timeline:{month:number,totalBalanceCents:number}[]=[];
  if (lumpSumCents>0) { rows.sort((a,b)=>strategy==='snowball'?a.balanceCents-b.balanceCents:b.aprBps-a.aprBps); let left=lumpSumCents; for(const d of rows){ const p=Math.min(left,d.balanceCents); d.balanceCents-=p; left-=p; if(left<=0) break; } }
  while(rows.some(d=>d.balanceCents>0) && month<600){ month++; const active=rows.filter(d=>d.balanceCents>0); let monthlyInterest=0; for(const d of active){ const interest=Math.round(d.balanceCents*(d.aprBps/10000)/12); d.balanceCents+=interest; totalInterest+=interest; monthlyInterest+=interest; }
    let pool=active.reduce((s,d)=>s+d.minimumPaymentCents,0)+extraMonthlyCents; if(pool<=monthlyInterest && rows.some(d=>d.balanceCents>0)) { month=600; break; } rows.sort((a,b)=>strategy==='snowball'?a.balanceCents-b.balanceCents:b.aprBps-a.aprBps);
    for(const d of rows.filter(d=>d.balanceCents>0)){ const min=Math.min(d.minimumPaymentCents,d.balanceCents,pool); d.balanceCents-=min; pool-=min; }
    for(const d of rows.filter(d=>d.balanceCents>0)){ if(pool<=0) break; const p=Math.min(pool,d.balanceCents); d.balanceCents-=p; pool-=p; }
    timeline.push({month,totalBalanceCents:rows.reduce((s,d)=>s+d.balanceCents,0)});
  }
  return { months: month, totalInterestCents: totalInterest, payoffDate: new Date(new Date().getFullYear(), new Date().getMonth()+month, 1), timeline };
}
