const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const existingQueue = await prisma.queueEntry.findUnique({ where: { appointmentId: 23 } }); // Assuming 23 is appointment ID.
  console.log('existingQueue', existingQueue);
}
main().finally(() => prisma.$disconnect());
