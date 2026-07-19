import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const withNhlId = await prisma.player.count({
    where: {
      nhlId: {
        not: null,
      },
    },
  });

  const total = await prisma.player.count();

  console.log({
    total,
    withNhlId,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });