import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        {
          name: {
            contains: "Pastr",
            mode: "insensitive",
          },
        },
        {
          name: {
            contains: "Lafren",
            mode: "insensitive",
          },
        },
        {
          name: {
            contains: "Kopitar",
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      nhlId: true,
    },
  });

  console.dir(players, {
    depth: null,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });