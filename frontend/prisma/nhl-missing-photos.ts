import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      photoUrl: null,
      nhlId: {
        not: null,
      },
    },
    select: {
      name: true,
      nhlId: true,
      teamId: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  console.log(
    `NHL PLAYERS MISSING PHOTOS: ${players.length}`
  );

  console.log(
    JSON.stringify(players, null, 2)
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });