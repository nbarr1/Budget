import { cookies } from 'next/headers'; import { prisma } from './db';
export async function currentUser(){ const jar=await cookies(); const ok=jar.get('budget_auth')?.value===process.env.AUTH_SECRET; if(!ok) return null; return prisma.user.findFirst(); }
export async function requireUser(){ const u=await currentUser(); if(!u) throw new Error('Unauthorized'); return u; }
