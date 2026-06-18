import { cookies } from 'next/headers'; import { prisma } from './db';
export async function currentUser(){ const jar=await cookies(); const secret=process.env.AUTH_SECRET; if(!secret && process.env.NODE_ENV==='production') throw new Error('AUTH_SECRET is not configured'); const ok=jar.get('budget_auth')?.value===(secret ?? 'dev-secret'); if(!ok) return null; return prisma.user.findFirst(); }
export async function requireUser(){ const u=await currentUser(); if(!u) throw new Error('Unauthorized'); return u; }
