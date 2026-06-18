import { prisma } from './db';
const DEFAULT_USER_EMAIL = 'you@example.com';
export async function getOrCreateDefaultUser(){ return prisma.user.upsert({where:{email:DEFAULT_USER_EMAIL},update:{},create:{email:DEFAULT_USER_EMAIL}}); }
export async function currentUser(){ return getOrCreateDefaultUser(); }
export async function requireUser(){ return currentUser(); }
