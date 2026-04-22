const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.clinicSettings.findFirst().then(s => {
  console.log("URL:", s.evolutionApiUrl);
  console.log("Instance:", s.evolutionInstanceName);
  console.log("ApiKey:", s.evolutionApiKey);
}).finally(() => prisma.$disconnect());
