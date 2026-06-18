import { prisma } from '../src/lib/db';
async function main(){ await prisma.importJob.deleteMany(); await prisma.bankConnection.deleteMany(); await prisma.goal.deleteMany(); await prisma.debt.deleteMany(); await prisma.entry.deleteMany(); await prisma.account.deleteMany(); await prisma.user.deleteMany(); }
main().finally(()=>prisma.$disconnect());
