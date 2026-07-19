import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      name: {
        contains: "Wyatt",
      },
    },
    select: {
      name: true,
      slug: true,
      photoUrl: true,
    },
  });

  console.log(players);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });