import { cookies } from 'next/headers'; import { prisma } from './db';
export async function currentUser(){ const jar=await cookies(); const secret=process.env.AUTH_SECRET || 'dev-secret'; const ok=jar.get('budget_auth')?.value===secret; if(!ok) return null; return prisma.user.findFirst(); }
export async function requireUser(){ const u=await currentUser(); if(!u) throw new Error('Unauthorized'); return u; }
