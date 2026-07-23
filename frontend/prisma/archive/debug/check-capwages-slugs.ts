import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    take: 20,
    select: {
      name: true,
      slug: true,
    },
  });

  console.table(players);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });