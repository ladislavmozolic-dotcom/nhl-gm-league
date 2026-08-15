import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      birthDate: null,
    },
    select: {
      name: true,
      nhlId: true,
    },
  });

  const withNhlId = players.filter(
    p => p.nhlId !== null
  );

  const withoutNhlId = players.filter(
    p => p.nhlId === null
  );

  console.log({
    total: players.length,
    withNhlId: withNhlId.length,
    withoutNhlId: withoutNhlId.length,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });