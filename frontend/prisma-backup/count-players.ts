import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.player.count();

  const nhlPlayers = await prisma.player.count({
    where: {
      nhlId: {
        not: null,
      },
    },
  });

  console.log({
    totalPlayers: total,
    nhlPlayers,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });