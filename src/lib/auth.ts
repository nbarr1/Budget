import { cookies } from 'next/headers'; import { prisma } from './db';
export async function currentUser(){ const jar=await cookies(); const ok=jar.get('budget_auth')?.value===(process.env.AUTH_SECRET ?? 'dev-secret'); if(!ok) return null; let user = await prisma.user.findFirst(); if (!user) { user = await prisma.user.create({ data: { email: 'you@example.com', bufferCents: 50000 } }); } return user; }
export async function requireUser(){ const u=await currentUser(); if(!u) throw new Error('Unauthorized'); return u; }
