import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.player.count();

  const missingBirthDate = await prisma.player.count({
    where: {
      birthDate: null,
    },
  });

  const missingHeight = await prisma.player.count({
    where: {
      height: null,
    },
  });

  const missingWeight = await prisma.player.count({
    where: {
      weight: null,
    },
  });

  const missingShoots = await prisma.player.count({
    where: {
      shoots: null,
    },
  });

  console.log({
    total,
    missingBirthDate,
    missingHeight,
    missingWeight,
    missingShoots,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });