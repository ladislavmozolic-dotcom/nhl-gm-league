import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      capHit: null,
    },
    select: {
      name: true,
      slug: true,
      nhlId: true,
      team: {
        select: {
          name: true,
        },
      },
    },
    take: 100,
  });

  console.table(players);
  console.log("Missing contracts:", players.length);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });