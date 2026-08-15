import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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

    const firstHttps =
      player.photoUrl.indexOf("https://");

    if (firstHttps === -1) {
      continue;
    }

    const jpg =
      player.photoUrl.indexOf(".jpg");

    const png =
      player.photoUrl.indexOf(".png");

    let end = -1;

    if (jpg !== -1) {
      end = jpg + 4;
    } else if (png !== -1) {
      end = png + 4;
    }

    if (end === -1) {
      continue;
    }

    const cleanUrl =
      player.photoUrl.substring(
        firstHttps,
        end
      );

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

  console.log({
    fixed,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });