const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const queue = await prisma.queueEntry.findMany({ include: { appointment: true } });
  console.log(queue.map(q => ({id: q.id, queueStatus: q.status, appStatus: q.appointment.status})));
}
main().finally(() => prisma.$disconnect());
