import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.player.count();

  const capHit = await prisma.player.count({
    where: {
      capHit: {
        not: null,
      },
    },
  });

  const contractYears = await prisma.player.count({
    where: {
      contractYears: {
        not: null,
      },
    },
  });

  const contractExpiry = await prisma.player.count({
    where: {
      contractExpiry: {
        not: null,
      },
    },
  });

  console.log({
    total,
    capHit,
    contractYears,
    contractExpiry,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
