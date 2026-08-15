import { PrismaClient } from () {
  const players = await prisma.player.findMany({
    where: {
      photoUrl: {
        not: null,
      },
    },
    select: {
      id: true,
      photoUrl: true,
    },
  });

  let fixed = 0;

  for (const player of players) {
    if (!player.photoUrl) {
      continue;
    }

    const match = player.photoUrl.match(
      /assets\.nhle\.com\/mugs\/nhl\/latest\/168x168\/\d+\.png/
    );

    if (!match) {
      continue;
    }

    const cleanUrl =
      "https" +
      "://" +
      match[0];

    await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        photoUrl: cleanUrl,
      },
    });

    fixed++;
  }

  console.log({ fixed });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });