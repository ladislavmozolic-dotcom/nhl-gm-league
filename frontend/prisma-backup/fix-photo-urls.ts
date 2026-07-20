import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      nhlId: {
        not: null,
      },
    },
    select: {
      id: true,
      nhlId: true,
    },
  });

  let fixed = 0;

  for (const player of players) {
    if (!player.nhlId) {
      continue;
    }

    const photoUrl =
      "https://" +
      "assets.nhle.com" +
      "/mugs/nhl/latest/168x168/" +
      player.nhlId +
      ".png";

    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        photoUrl,
      },
    });

    fixed++;
  }

  console.log({
    fixed,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });