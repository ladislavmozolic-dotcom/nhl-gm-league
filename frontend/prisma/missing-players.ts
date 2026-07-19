import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    where: {
      birthDate: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    take: 100,
  });

  console.table(players);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });