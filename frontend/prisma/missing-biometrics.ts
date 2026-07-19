import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { height: null },
        { weight: null },
        { shoots: null },
      ],
    },
    select: {
      name: true,
      slug: true,
      frozenPoolId: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  console.table(players);

  console.log(`TOTAL: ${players.length}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });