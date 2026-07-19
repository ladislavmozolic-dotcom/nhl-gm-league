import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const players = await prisma.player.findMany({
    take: 10,
    select: {
      name: true,
      slug: true,
      frozenPoolPlayerSlug: true,
    },
  });

  console.log(players);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });