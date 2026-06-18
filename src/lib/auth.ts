import { cookies } from 'next/headers'; import { prisma } from './db';
const DEFAULT_USER_EMAIL = 'you@example.com';
export async function getOrCreateDefaultUser(){ return prisma.user.upsert({where:{email:DEFAULT_USER_EMAIL},update:{},create:{email:DEFAULT_USER_EMAIL}}); }
export async function currentUser(){ const jar=await cookies(); const ok=jar.get('budget_auth')?.value===(process.env.AUTH_SECRET ?? 'dev-secret'); if(!ok) return null; return (await prisma.user.findFirst()) ?? getOrCreateDefaultUser(); }
export async function requireUser(){ const u=await currentUser(); if(!u) throw new Error('Unauthorized'); return u; }
