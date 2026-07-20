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
      team: {
        select: {
          code: true,
        },
      },
    },
  });

  let updated = 0;
  const season = "20262027";

  for (const player of players) {
    if (!player.nhlId || !player.team?.code) {
      continue;
    }

    const photoUrl =
      `https://assets.nhle.com/mugs/nhl/${season}/${player.team.code}/${player.nhlId}.png`;

    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        photoUrl,
      },
    });

    updated++;
  }

  console.log({
    updated,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
