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
      name: true,
      photoUrl: true,
    },
    take: 5,
  });

  console.log(players);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });