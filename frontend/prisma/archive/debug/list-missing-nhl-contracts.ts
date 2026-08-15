import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      capHit: null,
      nhlId: {
        not: null,
      },
    },
    select: {
      name: true,
      slug: true,
      nhlId: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  console.table(players);
  console.log("Count:", players.length);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });