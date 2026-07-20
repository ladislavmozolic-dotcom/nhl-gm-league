import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      name: {
        contains: "Zach",
      },
    },
    select: {
      id: true,
      name: true,
      nhlId: true,
      positions: true,
      slug: true,
    },
  });

  console.log(players);
}

main().finally(async () => {
  await prisma.$disconnect();
});