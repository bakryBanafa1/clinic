const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.queueEntry.updateMany({
    where: { appointment: { status: 'cancelled' } },
    data: { status: 'skipped' }
  });
  await prisma.queueEntry.updateMany({
    where: { appointment: { status: 'completed' } },
    data: { status: 'completed' }
  });
  console.log('Cleanup complete');
}
main().finally(() => prisma.$disconnect());
